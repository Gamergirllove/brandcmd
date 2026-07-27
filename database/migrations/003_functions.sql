-- ============================================================
-- Migration 003: Postgres Functions
-- Creator Analytics Platform
-- ============================================================

-- ============================================================
-- FUNCTION: get_platform_connection_status
-- Returns one row per platform showing whether the calling user
-- has a connected token and, if so, their platform username and
-- the timestamp when the connection was first made.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_platform_connection_status(
  p_user_id uuid
)
RETURNS TABLE (
  platform      text,
  connected     bool,
  username      text,
  connected_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Cross-join all known platforms against existing tokens so every
  -- platform always appears in the result, even when not connected.
  SELECT
    p.platform::text,
    (t.id IS NOT NULL)          AS connected,
    t.platform_username         AS username,
    t.created_at                AS connected_at
  FROM (
    -- Enumerate every possible platform value from the enum type.
    SELECT unnest(enum_range(NULL::platform_type)) AS platform
  ) p
  LEFT JOIN public.platform_tokens t
    ON  t.platform = p.platform
    AND t.user_id  = p_user_id
  ORDER BY p.platform;
$$;

COMMENT ON FUNCTION public.get_platform_connection_status(uuid) IS
  'Returns connection status for all 8 platforms for the given user. '
  'Always returns 8 rows regardless of which platforms are connected.';

-- ============================================================
-- FUNCTION: upsert_analytics
-- Insert or update a single analytics_cache row.
-- Called by the backend data-fetch workers to store retrieved metrics.
-- Uses SECURITY DEFINER so it can bypass RLS from the service role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_analytics(
  p_user_id     uuid,
  p_platform    text,
  p_metric_type text,
  p_date        date,
  p_value       bigint,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.analytics_cache (
    user_id,
    platform,
    metric_type,
    date,
    value,
    metadata,
    fetched_at
  )
  VALUES (
    p_user_id,
    p_platform::platform_type,
    p_metric_type,
    p_date,
    p_value,
    p_metadata,
    now()
  )
  ON CONFLICT (user_id, platform, metric_type, date)
  DO UPDATE SET
    value      = EXCLUDED.value,
    metadata   = EXCLUDED.metadata,
    fetched_at = now();
END;
$$;

COMMENT ON FUNCTION public.upsert_analytics(uuid, text, text, date, bigint, jsonb) IS
  'Insert or refresh a single analytics_cache entry. '
  'Idempotent — safe to call repeatedly for the same user/platform/metric/date.';

-- ============================================================
-- FUNCTION: get_analytics_overview
-- Returns aggregated stats across all connected platforms for the
-- last p_days calendar days. Result shape is JSONB so the frontend
-- can consume it without a fixed column set.
--
-- Sample output:
-- {
--   "period_days": 30,
--   "platforms": {
--     "youtube": {
--       "views":      1234567,
--       "followers":  9999,
--       "likes":      45000,
--       "comments":   3200,
--       "days_cached": 28
--     },
--     "instagram": { ... }
--   },
--   "totals": {
--     "views": 2000000,
--     "followers": 15000,
--     "likes": 80000,
--     "comments": 5000
--   }
-- }
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_analytics_overview(
  p_user_id uuid,
  p_days    int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date  date := current_date - (p_days - 1);
  v_result      jsonb;
  v_platforms   jsonb := '{}'::jsonb;
  v_totals      jsonb := '{}'::jsonb;
  v_row         record;
  v_platform    text;
  v_platform_data jsonb;
  v_metric      text;
  v_sum         bigint;
  v_days_cached int;
BEGIN
  -- Build per-platform aggregates
  FOR v_row IN
    SELECT
      platform::text                          AS platform,
      metric_type,
      SUM(value)                              AS total_value,
      COUNT(DISTINCT date)                    AS days_cached
    FROM public.analytics_cache
    WHERE user_id = p_user_id
      AND date   >= v_start_date
    GROUP BY platform, metric_type
    ORDER BY platform, metric_type
  LOOP
    -- Initialise platform object if first row for this platform
    IF NOT (v_platforms ? v_row.platform) THEN
      v_platforms := v_platforms || jsonb_build_object(
        v_row.platform, jsonb_build_object('days_cached', v_row.days_cached)
      );
    END IF;

    -- Add metric to platform object
    v_platforms := jsonb_set(
      v_platforms,
      ARRAY[v_row.platform, v_row.metric_type],
      to_jsonb(v_row.total_value)
    );

    -- Accumulate cross-platform totals
    IF v_totals ? v_row.metric_type THEN
      v_totals := jsonb_set(
        v_totals,
        ARRAY[v_row.metric_type],
        to_jsonb((v_totals ->> v_row.metric_type)::bigint + v_row.total_value)
      );
    ELSE
      v_totals := v_totals || jsonb_build_object(v_row.metric_type, v_row.total_value);
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'period_days', p_days,
    'start_date',  v_start_date,
    'end_date',    current_date,
    'platforms',   v_platforms,
    'totals',      v_totals
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_analytics_overview(uuid, int) IS
  'Returns a JSONB summary of analytics across all platforms for the last N days. '
  'Pulls from analytics_cache — call the data-fetch workers first if freshness matters.';
