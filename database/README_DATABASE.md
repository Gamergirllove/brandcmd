# Creator Analytics Platform — Database Setup

Complete setup guide for the Supabase database backend.

---

## Prerequisites

- Node.js 18+ (for Supabase CLI)
- Docker Desktop (running) — required for local Supabase stack
- PostgreSQL client (`psql`) — optional, for direct DB access

---

## Step 1 — Install the Supabase CLI

```bash
# macOS / Linux (npm)
npm install -g supabase

# macOS (Homebrew)
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify
supabase --version   # should be 1.150+ (check https://github.com/supabase/cli/releases)
```

---

## Step 2 — Initialise the project

```bash
# From your project root
supabase init

# This creates:
#   supabase/config.toml      (already provided — replace the generated one)
#   supabase/migrations/      (already provided)
#   supabase/seed.sql         (point it at scripts/seed.sql — see Step 4)
```

Copy the provided `supabase/config.toml` into the generated `supabase/` directory, overwriting the default.

---

## Step 3 — Start the local Supabase stack

```bash
supabase start
```

Docker pulls the required images on the first run (this takes a few minutes).
Once running you will see:

```
API URL:      http://localhost:54321
GraphQL URL:  http://localhost:54321/graphql/v1
DB URL:       postgresql://postgres:postgres@localhost:54322/postgres
Studio URL:   http://localhost:54323
Inbucket URL: http://localhost:54324   ← catches all outbound email
anon key:     eyJ...
service_role key: eyJ...
```

---

## Step 4 — Apply migrations

```bash
# Apply all migrations in order (001 → 006)
supabase db push

# Or, to reset and re-seed from scratch:
supabase db reset
```

To run migrations manually against any Postgres instance:

```bash
psql $DATABASE_URL -f migrations/001_initial_schema.sql
psql $DATABASE_URL -f migrations/002_rls_policies.sql
psql $DATABASE_URL -f migrations/003_functions.sql
psql $DATABASE_URL -f migrations/004_triggers.sql
psql $DATABASE_URL -f migrations/005_add_twitch_platform.sql
psql $DATABASE_URL -f migrations/006_goals_and_onboarding.sql
```

**Run 005 and 006 as separate statements/transactions.** 005 adds `twitch`
to the `platform_type` enum, and Postgres will not let a new enum value be
used until the transaction that added it commits — which 006 does. Running
them as one transaction fails.

---

## Step 5 — Load seed data (local dev only)

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres \
     -f scripts/seed.sql
```

Or configure Supabase to auto-seed on reset by adding to `supabase/config.toml`:

```toml
[db.seed]
enabled = true
sql_paths = ["../scripts/seed.sql"]
```

---

## Step 6 — Set environment variables

```bash
cp supabase/.env.example .env.local   # or .env
```

Fill in all values. For local dev the `anon key` and `service_role key` are printed by `supabase start`. For production, find them at:

> Supabase Dashboard → Your Project → Settings → API

**Never commit `.env.local` or `.env` to version control.**

---

## Step 7 — Configure OAuth providers in Supabase Dashboard

### 7a. Google (YouTube)

Needed for: YouTube Data API analytics

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create a new project (or reuse one).
2. Enable APIs:
   - **YouTube Data API v3**
   - **YouTube Analytics API**
   - **Google Identity** (included by default)
3. Go to **APIs & Services → Credentials → Create OAuth 2.0 Client ID** (type: Web application).
4. Add Authorized Redirect URIs:
   - Local: `http://localhost:54321/auth/v1/callback`
   - Production: `https://<your-project>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**.
6. In Supabase Dashboard → Authentication → Providers → Google: paste them in and enable.
7. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.

**Required credentials:** Google Client ID, Google Client Secret

---

### 7b. Meta (Facebook + Instagram)

Needed for: Facebook Page Insights, Instagram Business/Creator analytics

1. Go to [Meta for Developers](https://developers.facebook.com/apps/) → Create App → **Business** type.
2. Add products: **Facebook Login**, **Instagram Graph API**.
3. Under Facebook Login → Settings → Valid OAuth Redirect URIs:
   - Local: `http://localhost:54321/auth/v1/callback`
   - Production: `https://<your-project>.supabase.co/auth/v1/callback`
4. Required permissions (request under App Review for production):
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_manage_insights`
   - `read_insights`
5. Copy the **App ID** and **App Secret** from App Settings → Basic.
6. In Supabase Dashboard → Authentication → Providers → Facebook: paste them in and enable.
7. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in `.env.local`.

**Required credentials:** Meta App ID, Meta App Secret

---

### 7c. TikTok

Needed for: TikTok Business API analytics (views, followers, video performance)

TikTok does NOT have a Supabase OAuth provider — handle the OAuth flow in your own backend (Edge Function or Next.js API route) and store tokens in `platform_tokens`.

1. Go to [TikTok for Developers](https://developers.tiktok.com/) → Create App.
2. Add products: **Login Kit**, **Research API** (or **Content Posting API** depending on use case).
3. Set Redirect URI:
   - Local: `http://localhost:3000/api/auth/tiktok/callback`
   - Production: `https://your-domain.com/api/auth/tiktok/callback`
4. Required scopes:
   - `user.info.basic`
   - `video.list`
   - `video.insights` (requires approval)
5. Copy the **Client Key** and **Client Secret**.
6. Set `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` in `.env.local`.

**Required credentials:** TikTok Client Key, TikTok Client Secret

---

### 7d. Twitter / X

Needed for: X (Twitter) analytics — impressions, engagements, follower count

Twitter OAuth 2.0 is partially supported as a Supabase provider for authentication. For analytics-scope tokens, implement the PKCE flow in your backend.

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard) → Create Project → Create App.
2. Set App permissions to **Read** (analytics only) or **Read and Write** if posting is needed.
3. Enable **OAuth 2.0** — set Type to **Web App**.
4. Set Callback URI:
   - Local: `http://localhost:3000/api/auth/twitter/callback`
   - Production: `https://your-domain.com/api/auth/twitter/callback`
5. Required scopes: `tweet.read`, `users.read`, `offline.access`
6. Copy the **Client ID** and **Client Secret**.
7. Set `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` in `.env.local`.

**Required credentials:** Twitter Client ID, Twitter Client Secret

---

### 7e. Pinterest

Needed for: Pinterest analytics — impressions, saves, pin clicks, audience

1. Go to [Pinterest Developer Portal](https://developers.pinterest.com/apps/) → Create App.
2. Set Redirect URI:
   - Local: `http://localhost:3000/api/auth/pinterest/callback`
   - Production: `https://your-domain.com/api/auth/pinterest/callback`
3. Required scopes:
   - `boards:read`
   - `pins:read`
   - `user_accounts:read`
   - `pins:read_secret` (if reading analytics)
4. Copy the **App ID** and **App Secret**.
5. Set `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET` in `.env.local`.

**Required credentials:** Pinterest App ID, Pinterest App Secret

---

### 7f. LinkedIn

Needed for: LinkedIn Creator analytics — impressions, followers, engagement

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) → Create App.
2. Associate the app with a LinkedIn Page (required for analytics access).
3. Request the following Products:
   - **Sign In with LinkedIn using OpenID Connect** (for authentication)
   - **Share on LinkedIn**
   - **Marketing Developer Platform** (for analytics — requires approval)
4. Set Redirect URL:
   - Local: `http://localhost:3000/api/auth/linkedin/callback`
   - Production: `https://your-domain.com/api/auth/linkedin/callback`
5. Required permissions: `r_liteprofile`, `r_emailaddress`, `r_organization_social`, `rw_organization_admin`
6. Copy the **Client ID** and **Client Secret** from the **Auth** tab.
7. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `.env.local`.

**Required credentials:** LinkedIn Client ID, LinkedIn Client Secret

---

### 7g. Snapchat

Needed for: Snapchat Insights — story views, reach, subscribers

1. Go to [Snap Kit Developer Portal](https://kit.snapchat.com/manage/) → Create App.
2. Enable **Login Kit**.
3. Set Redirect URL:
   - Local: `http://localhost:3000/api/auth/snapchat/callback`
   - Production: `https://your-domain.com/api/auth/snapchat/callback`
4. Required scopes:
   - `https://auth.snapchat.com/oauth2/api/user.display_name`
   - `https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar`
   - Additional analytics scopes require Snap Partner approval.
5. Copy the **Client ID** (OAuth2 Client ID) and **Client Secret**.
6. Set `SNAPCHAT_CLIENT_ID` and `SNAPCHAT_CLIENT_SECRET` in `.env.local`.

**Required credentials:** Snapchat Client ID, Snapchat Client Secret

---

## Database Structure Reference

```
public
├── profiles             — user profile, creator identity, onboarding state
├── platform_tokens      — encrypted OAuth tokens per platform
├── goals                — creator targets; current_value refreshed on read
├── oauth_states         — in-flight OAuth: CSRF state + PKCE verifier
├── analytics_cache      — fetched metrics (reduce API call volume)
└── api_usage_log        — append-only log for rate-limit tracking

Functions
├── get_platform_connection_status(user_id)
│     → one row per platform: platform, connected, username, connected_at
├── upsert_analytics(user_id, platform, metric_type, date, value, metadata)
│     → inserts or updates analytics_cache
├── get_analytics_overview(user_id, days)
│     → jsonb: per-platform + cross-platform totals for last N days
└── purge_expired_oauth_states()
      → deletes stale oauth_states rows, returns the count

Triggers
├── on_auth_user_created  → auto-creates profiles row on sign-up
├── trg_profiles_updated_at        → keeps updated_at current
├── trg_platform_tokens_updated_at → keeps updated_at current
└── trg_goals_updated_at           → keeps updated_at current
```

### Row Level Security

Every table has RLS enabled and is scoped to `auth.uid()`, except
`oauth_states`, which has **no policies at all** — it is server-side only
and reachable exclusively by the backend's service role, which bypasses
RLS. The backend uses the service role for all access and always filters
by `user_id` itself.

---

## Token Encryption Model

Encryption happens in the **application layer only**. The backend wraps
each access and refresh token with Fernet before insert, and unwraps it on
read:

```
raw token ──Fernet.encrypt(TOKEN_ENCRYPTION_KEY)──▶ platform_tokens.access_token
```

Everything else on the row — `expires_at`, `scope`, `platform_user_id`,
`platform_username` — is stored in the clear. None of it is secret, and
keeping it queryable is what lets the connect page and expiry checks work
without decrypting anything.

`app/services/token_store.py` is the only module that encrypts or
decrypts. It derives the Fernet key from `TOKEN_ENCRYPTION_KEY`, falling
back to stretching `SECRET_KEY` with SHA-256 if the former is unset.

### Key rotation

Changing `TOKEN_ENCRYPTION_KEY` makes every stored token unreadable.
`retrieve_tokens` treats an undecryptable row as *not connected* rather
than raising, so the app stays up — but every user must reconnect their
platforms. To rotate deliberately, clear the table and let users
reconnect:

```sql
TRUNCATE public.platform_tokens;
```

> An earlier draft of this document described a second pgcrypto layer
> (`pgp_sym_encrypt` over the Fernet ciphertext). That was never
> implemented; the columns hold Fernet ciphertext directly. The `pgcrypto`
> extension is still enabled — `gen_random_bytes` is used by the
> `handle_new_user` trigger.

---

## Useful Commands

```bash
# View local Supabase status
supabase status

# Open Supabase Studio (local)
open http://localhost:54323

# Connect directly to local DB
psql postgresql://postgres:postgres@localhost:54322/postgres

# Stop local stack
supabase stop

# Generate TypeScript types from schema
supabase gen types typescript --local > types/database.types.ts

# Check migration diff
supabase db diff

# Push migrations to hosted Supabase project
supabase db push --db-url postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```
