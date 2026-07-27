-- ============================================================
-- Migration 006: Goals, onboarding state, OAuth state store
-- BrandCommand
-- ============================================================

-- ============================================================
-- PROFILES — onboarding + creator identity columns
-- The onboarding flow and the settings page both write these.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_handle      text,
  ADD COLUMN IF NOT EXISTS creator_type        text,
  ADD COLUMN IF NOT EXISTS notification_prefs  jsonb NOT NULL DEFAULT
    '{"weekly_report": true, "goal_complete": true, "milestone": false}'::jsonb;

COMMENT ON COLUMN public.profiles.onboarding_complete IS
  'False until the user finishes the onboarding wizard. Middleware redirects on false.';
COMMENT ON COLUMN public.profiles.creator_type IS
  'One of: gaming, music, lifestyle, tech_education, art_design, other.';
COMMENT ON COLUMN public.profiles.notification_prefs IS
  'Email notification toggles surfaced on the settings page.';

-- Existing rows predate the wizard; treat them as already onboarded
-- so they are not bounced back into it on their next sign-in.
UPDATE public.profiles SET onboarding_complete = true WHERE created_at < now();

-- Profiles are created by the handle_new_user trigger, but the backend
-- upserts them too (service role). Allow users to insert their own row
-- so a missing profile self-heals instead of 500ing.
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- TABLE: goals
-- One row per creator goal. current_value is refreshed from live
-- platform analytics; completed flips when current >= target.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.goals (
  id            uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          text          NOT NULL,
  platform      platform_type NOT NULL,
  target_value  bigint        NOT NULL CHECK (target_value > 0),
  current_value bigint        NOT NULL DEFAULT 0,
  completed     boolean       NOT NULL DEFAULT false,
  completed_at  timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.goals IS 'Creator goals set during onboarding or from the goals page.';
COMMENT ON COLUMN public.goals.type IS
  'Goal metric key, e.g. twitch_followers, twitch_avg_viewers, youtube_subscribers, youtube_monthly_views.';
COMMENT ON COLUMN public.goals.current_value IS
  'Last known value of the tracked metric. Refreshed by GET /goals.';

CREATE INDEX IF NOT EXISTS idx_goals_user_created
  ON public.goals (user_id, created_at DESC);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goals_select_own ON public.goals;
CREATE POLICY goals_select_own
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS goals_insert_own ON public.goals;
CREATE POLICY goals_insert_own
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS goals_update_own ON public.goals;
CREATE POLICY goals_update_own
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS goals_delete_own ON public.goals;
CREATE POLICY goals_delete_own
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE: oauth_states
-- Short-lived CSRF state + PKCE code_verifier for in-flight OAuth
-- authorisations. Written when we hand the user to the provider,
-- read (and deleted) when the provider calls us back.
--
-- Server-side only: no RLS policies are defined, so the anon and
-- authenticated roles can reach nothing here. The backend uses the
-- service role, which bypasses RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oauth_states (
  state         text          PRIMARY KEY,
  user_id       uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform      platform_type NOT NULL,
  code_verifier text,
  redirect_to   text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  expires_at    timestamptz   NOT NULL DEFAULT now() + interval '15 minutes'
);

COMMENT ON TABLE  public.oauth_states IS 'In-flight OAuth authorisations: CSRF state + PKCE verifier. Service-role only.';
COMMENT ON COLUMN public.oauth_states.code_verifier IS 'PKCE verifier for providers that require it (Twitter/X, TikTok).';

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires
  ON public.oauth_states (expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTION: purge_expired_oauth_states
-- Housekeeping. Call from a scheduled job, or opportunistically
-- from the backend when it writes a new state row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_expired_oauth_states()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_oauth_states() IS
  'Deletes oauth_states rows past their expiry. Returns the number removed.';
