-- ============================================================
-- Migration 004: Triggers
-- Creator Analytics Platform
-- ============================================================

-- ============================================================
-- TRIGGER FUNCTION: handle_new_user
-- Automatically creates a profiles row whenever a new user
-- is inserted into auth.users (i.e., on every new sign-up).
-- Uses SECURITY DEFINER so it can INSERT despite RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    -- Derive a default username from the email local-part (before @).
    -- Users can change this later. Append random hex to avoid collisions.
    lower(split_part(NEW.email, '@', 1))
      || '_'
      || substr(encode(gen_random_bytes(3), 'hex'), 1, 6),
    -- Use the full_name from raw_user_meta_data if the OAuth provider supplied it.
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    -- Avatar from OAuth provider if available.
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;  -- Idempotent: ignore if profile already exists.

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function: auto-creates a profiles row on new auth.users insert. '
  'Derives a default username from the email local-part + random suffix.';

-- Attach the trigger to auth.users (runs AFTER INSERT).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER FUNCTION: set_updated_at
-- Generic function that sets updated_at = now() before any UPDATE.
-- Attach this to any table that has an updated_at column.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Generic BEFORE UPDATE trigger function: sets updated_at = now().';

-- ---- profiles -----------------------------------------------
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---- platform_tokens ----------------------------------------
DROP TRIGGER IF EXISTS trg_platform_tokens_updated_at ON public.platform_tokens;
CREATE TRIGGER trg_platform_tokens_updated_at
  BEFORE UPDATE ON public.platform_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
