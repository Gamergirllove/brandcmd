-- ============================================================
-- Migration 002: Row Level Security Policies
-- Creator Analytics Platform
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read only their own profile row.
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update only their own profile row.
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert is handled exclusively by the handle_new_user trigger
-- (runs as SECURITY DEFINER). Direct INSERT from client is blocked.
-- If you need to allow it (e.g. for testing), add a policy here.

-- ============================================================
-- PLATFORM_TOKENS
-- ============================================================

ALTER TABLE public.platform_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read only their own tokens.
CREATE POLICY platform_tokens_select_own
  ON public.platform_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert tokens for themselves only.
CREATE POLICY platform_tokens_insert_own
  ON public.platform_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own tokens.
CREATE POLICY platform_tokens_update_own
  ON public.platform_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (disconnect) only their own tokens.
CREATE POLICY platform_tokens_delete_own
  ON public.platform_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- ANALYTICS_CACHE
-- ============================================================

ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

-- Users can read only their own cached analytics.
CREATE POLICY analytics_cache_select_own
  ON public.analytics_cache
  FOR SELECT
  USING (auth.uid() = user_id);

-- The backend service role (SECURITY DEFINER functions / service key)
-- handles inserts/upserts into analytics_cache; direct client insert
-- is intentionally not exposed. If you ever need to allow it, add:
--
-- CREATE POLICY analytics_cache_insert_own
--   ON public.analytics_cache
--   FOR INSERT
--   WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- API_USAGE_LOG
-- ============================================================

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can append log entries for themselves only.
CREATE POLICY api_usage_log_insert_own
  ON public.api_usage_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own log entries (useful for dashboard rate-limit display).
CREATE POLICY api_usage_log_select_own
  ON public.api_usage_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- No UPDATE or DELETE policies — this is an append-only log.
-- Periodic purging is handled by a scheduled backend job using the service role.
