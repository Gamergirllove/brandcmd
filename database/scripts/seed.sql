-- ============================================================
-- Seed Data — Local Development Only
-- Creator Analytics Platform
-- ============================================================
-- Run AFTER migrations have been applied.
-- Uses a fixed UUID so this script is idempotent (safe to re-run).
--
-- Usage:
--   supabase db reset        (applies migrations + this seed)
--   psql $DATABASE_URL -f scripts/seed.sql
-- ============================================================

-- ============================================================
-- 1. Insert a test user into auth.users
-- (The handle_new_user trigger will auto-create the profiles row,
--  but we INSERT directly here because auth schema access is
--  available in local dev via the postgres role.)
-- ============================================================

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN

  -- Insert the auth user only if it does not already exist.
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    v_user_id,
    'authenticated',
    'authenticated',
    'dev-creator@example.com',
    crypt('devpassword123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"full_name": "Dev Creator", "avatar_url": "https://i.pravatar.cc/150?u=dev-creator"}',
    false,
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- Ensure the profile exists (trigger may have already created it).
  INSERT INTO public.profiles (
    id, username, display_name, avatar_url,
    creator_handle, creator_type, onboarding_complete
  )
  VALUES (
    v_user_id,
    'dev_creator',
    'Dev Creator',
    'https://i.pravatar.cc/150?u=dev-creator',
    'dev_creator',
    'gaming',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    username            = EXCLUDED.username,
    display_name        = EXCLUDED.display_name,
    avatar_url          = EXCLUDED.avatar_url,
    creator_handle      = EXCLUDED.creator_handle,
    creator_type        = EXCLUDED.creator_type,
    onboarding_complete = EXCLUDED.onboarding_complete;

END $$;

-- ============================================================
-- 2. Mock platform_tokens
--
-- NOTE: these are plaintext placeholders for exercising the schema, RLS
-- policies and joins. The API encrypts tokens with Fernet before insert,
-- so it cannot decrypt these — it will report every seeded platform as
-- NOT connected. That is expected. To test a real connection, run the
-- OAuth flow through the app.
-- ============================================================

INSERT INTO public.platform_tokens
  (user_id, platform, access_token, refresh_token, expires_at, scope, platform_user_id, platform_username)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'twitch',    'tw_access_token_dev',  'tw_refresh_token_dev',  now() + interval '4 hours', 'user:read:email channel:read:subscriptions', '123456789', 'devcreator'),
  ('00000000-0000-0000-0000-000000000001', 'youtube',   'yt_access_token_dev',  'yt_refresh_token_dev',  now() + interval '1 hour', 'https://www.googleapis.com/auth/youtube.readonly', 'UCxxxxxxxxxxxxxxxxxx', 'DevCreatorYT'),
  ('00000000-0000-0000-0000-000000000001', 'instagram', 'ig_access_token_dev',  NULL,                    now() + interval '60 days', 'instagram_basic,instagram_manage_insights', '1234567890', 'dev_creator_ig'),
  ('00000000-0000-0000-0000-000000000001', 'tiktok',    'tt_access_token_dev',  'tt_refresh_token_dev',  now() + interval '1 day',  'user.info.basic,video.list', 'MS4wLjABAAAAdev', 'dev_creator_tt'),
  ('00000000-0000-0000-0000-000000000001', 'twitter',   'tw_access_token_dev',  'tw_refresh_token_dev',  now() + interval '2 hours', 'tweet.read users.read offline.access', '9876543210', 'DevCreatorX'),
  ('00000000-0000-0000-0000-000000000001', 'pinterest', 'pin_access_token_dev', 'pin_refresh_token_dev', now() + interval '1 hour', 'boards:read,pins:read,user_accounts:read', 'dev_creator_pin', 'DevCreatorPin'),
  ('00000000-0000-0000-0000-000000000001', 'linkedin',  'li_access_token_dev',  NULL,                    now() + interval '60 days', 'r_liteprofile r_emailaddress w_member_social', 'urn:li:person:devXXXXXX', 'Dev Creator'),
  ('00000000-0000-0000-0000-000000000001', 'snapchat',  'snap_access_token_dev','snap_refresh_token_dev',now() + interval '1 hour', 'https://auth.snapchat.com/oauth2/api/user.display_name https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar', 'dev_snap_id', 'DevCreatorSnap'),
  ('00000000-0000-0000-0000-000000000001', 'facebook',  'fb_access_token_dev',  NULL,                    now() + interval '60 days', 'pages_show_list pages_read_engagement', '111222333444', 'Dev Creator Page')
ON CONFLICT (user_id, platform) DO UPDATE SET
  access_token       = EXCLUDED.access_token,
  refresh_token      = EXCLUDED.refresh_token,
  expires_at         = EXCLUDED.expires_at,
  scope              = EXCLUDED.scope,
  platform_user_id   = EXCLUDED.platform_user_id,
  platform_username  = EXCLUDED.platform_username,
  updated_at         = now();

-- ============================================================
-- 3. Mock analytics_cache — 30 days of data for all 8 platforms
-- ============================================================

DO $$
DECLARE
  v_user_id  uuid   := '00000000-0000-0000-0000-000000000001';
  v_day      int;
  v_date     date;

  -- Per-platform base values (realistic orders of magnitude)
  type_row   record;
BEGIN
  FOR v_day IN 0..29 LOOP
    v_date := current_date - v_day;

    -- Twitch
    PERFORM public.upsert_analytics(v_user_id, 'twitch', 'views',     v_date, 900   + (random() * 800)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'twitch', 'followers', v_date, 8400  + (random() * 120)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'twitch', 'likes',     v_date, 120   + (random() * 90)::bigint,   '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'twitch', 'comments',  v_date, 30    + (random() * 25)::bigint,   '{"source": "seed"}');

    -- YouTube
    PERFORM public.upsert_analytics(v_user_id, 'youtube', 'views',     v_date, 4000  + (random() * 3000)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'youtube', 'followers', v_date, 15000 + (random() * 200)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'youtube', 'likes',     v_date, 300   + (random() * 200)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'youtube', 'comments',  v_date, 40    + (random() * 30)::bigint,   '{"source": "seed"}');

    -- Instagram
    PERFORM public.upsert_analytics(v_user_id, 'instagram', 'views',     v_date, 6000  + (random() * 4000)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'instagram', 'followers', v_date, 22000 + (random() * 150)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'instagram', 'likes',     v_date, 800   + (random() * 400)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'instagram', 'comments',  v_date, 60    + (random() * 40)::bigint,   '{"source": "seed"}');

    -- TikTok
    PERFORM public.upsert_analytics(v_user_id, 'tiktok', 'views',     v_date, 25000 + (random() * 20000)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'tiktok', 'followers', v_date, 48000 + (random() * 500)::bigint,   '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'tiktok', 'likes',     v_date, 2000  + (random() * 1500)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'tiktok', 'comments',  v_date, 150   + (random() * 100)::bigint,   '{"source": "seed"}');

    -- Twitter / X
    PERFORM public.upsert_analytics(v_user_id, 'twitter', 'views',     v_date, 3000 + (random() * 2000)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'twitter', 'followers', v_date, 8500 + (random() * 80)::bigint,   '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'twitter', 'likes',     v_date, 200  + (random() * 150)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'twitter', 'comments',  v_date, 25   + (random() * 20)::bigint,   '{"source": "seed"}');

    -- Pinterest
    PERFORM public.upsert_analytics(v_user_id, 'pinterest', 'views',     v_date, 1500 + (random() * 1000)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'pinterest', 'followers', v_date, 3200 + (random() * 30)::bigint,   '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'pinterest', 'likes',     v_date, 80   + (random() * 60)::bigint,   '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'pinterest', 'comments',  v_date, 10   + (random() * 8)::bigint,    '{"source": "seed"}');

    -- LinkedIn
    PERFORM public.upsert_analytics(v_user_id, 'linkedin', 'views',     v_date, 900  + (random() * 600)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'linkedin', 'followers', v_date, 5100 + (random() * 50)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'linkedin', 'likes',     v_date, 70   + (random() * 50)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'linkedin', 'comments',  v_date, 12   + (random() * 10)::bigint,  '{"source": "seed"}');

    -- Snapchat
    PERFORM public.upsert_analytics(v_user_id, 'snapchat', 'views',     v_date, 5000 + (random() * 4000)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'snapchat', 'followers', v_date, 7800 + (random() * 100)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'snapchat', 'likes',     v_date, 300  + (random() * 200)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'snapchat', 'comments',  v_date, 20   + (random() * 15)::bigint,   '{"source": "seed"}');

    -- Facebook
    PERFORM public.upsert_analytics(v_user_id, 'facebook', 'views',     v_date, 2000 + (random() * 1500)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'facebook', 'followers', v_date, 11000 + (random() * 100)::bigint, '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'facebook', 'likes',     v_date, 150  + (random() * 100)::bigint,  '{"source": "seed"}');
    PERFORM public.upsert_analytics(v_user_id, 'facebook', 'comments',  v_date, 18   + (random() * 12)::bigint,   '{"source": "seed"}');

  END LOOP;
END $$;

-- ============================================================
-- 4. Mock goals
-- One in progress, one already completed, so the goals page and the
-- dashboard "on track" counter both have something to render.
-- ============================================================

INSERT INTO public.goals (user_id, type, platform, target_value, current_value, completed, completed_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'twitch_followers',      'twitch',  10000, 8420,  false, NULL),
  ('00000000-0000-0000-0000-000000000001', 'youtube_subscribers',   'youtube', 10000, 12180, true,  now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000001', 'youtube_monthly_views', 'youtube', 150000, 94300, false, NULL)
ON CONFLICT DO NOTHING;
