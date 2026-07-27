-- ============================================================
-- Migration 001: Initial Schema
-- Creator Analytics Platform
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TYPES
-- ============================================================

CREATE TYPE platform_type AS ENUM (
  'youtube',
  'instagram',
  'tiktok',
  'twitter',
  'pinterest',
  'linkedin',
  'snapchat',
  'facebook'
);

-- ============================================================
-- TABLE: profiles
-- One row per authenticated user. Created automatically via
-- trigger when a new user signs up in auth.users.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       text        UNIQUE,
  display_name   text,
  avatar_url     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'Public profile data for each authenticated user.';
COMMENT ON COLUMN public.profiles.id IS 'Matches auth.users.id — one-to-one.';
COMMENT ON COLUMN public.profiles.username IS 'Unique handle chosen by the user.';

-- ============================================================
-- TABLE: platform_tokens
-- OAuth tokens per platform per user.
-- access_token and refresh_token are encrypted at rest with
-- pgcrypto gen_random_bytes key derivation. The application
-- layer additionally wraps values with Fernet before INSERT.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_tokens (
  id                 uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform           platform_type NOT NULL,
  -- Stored as bytea so pgcrypto encrypt/decrypt can be applied.
  -- The application Base64-encodes the Fernet ciphertext before
  -- passing it to pgp_sym_encrypt so the column remains text-like.
  access_token       text          NOT NULL,   -- pgp_sym_encrypt(fernet_ciphertext, app_secret)
  refresh_token      text,                     -- pgp_sym_encrypt(fernet_ciphertext, app_secret)
  expires_at         timestamptz,
  scope              text,
  platform_user_id   text,
  platform_username  text,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),

  -- A user can only have one active token set per platform.
  CONSTRAINT uq_user_platform UNIQUE (user_id, platform)
);

COMMENT ON TABLE  public.platform_tokens IS 'Encrypted OAuth tokens for each connected social platform.';
COMMENT ON COLUMN public.platform_tokens.access_token  IS 'pgp_sym_encrypt(fernet_ciphertext, app_secret) — double-encrypted.';
COMMENT ON COLUMN public.platform_tokens.refresh_token IS 'pgp_sym_encrypt(fernet_ciphertext, app_secret) — double-encrypted.';

-- ============================================================
-- TABLE: analytics_cache
-- Fetched metrics stored locally to reduce external API calls.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id           uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform     platform_type NOT NULL,
  metric_type  text          NOT NULL,  -- e.g. 'views', 'followers', 'likes', 'comments'
  date         date          NOT NULL,
  value        bigint        NOT NULL DEFAULT 0,
  metadata     jsonb,
  fetched_at   timestamptz   NOT NULL DEFAULT now(),

  -- One value per user/platform/metric/day — upsert-safe.
  CONSTRAINT uq_analytics_entry UNIQUE (user_id, platform, metric_type, date)
);

COMMENT ON TABLE  public.analytics_cache IS 'Local cache of fetched analytics data to minimise API quota usage.';
COMMENT ON COLUMN public.analytics_cache.metric_type IS 'Platform-specific metric name, e.g. views, followers, impressions.';
COMMENT ON COLUMN public.analytics_cache.metadata    IS 'Arbitrary extra data returned by the platform API for this metric.';

-- Composite index for fast time-range queries per user + platform
CREATE INDEX idx_analytics_cache_user_platform_date
  ON public.analytics_cache (user_id, platform, date DESC);

CREATE INDEX idx_analytics_cache_user_date
  ON public.analytics_cache (user_id, date DESC);

-- ============================================================
-- TABLE: api_usage_log
-- Lightweight append-only log for rate-limit tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id         uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform   platform_type NOT NULL,
  endpoint   text          NOT NULL,  -- e.g. '/youtube/v3/channels'
  called_at  timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.api_usage_log IS 'Append-only log of outbound API calls used for rate-limit tracking.';
COMMENT ON COLUMN public.api_usage_log.endpoint IS 'The specific API endpoint or method called.';

-- Index for rate-limit window lookups: "how many calls in the last N minutes?"
CREATE INDEX idx_api_usage_log_user_platform_called
  ON public.api_usage_log (user_id, platform, called_at DESC);
