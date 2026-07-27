# BrandCommand — Setup Guide

Everything you need to get from a fresh clone to a working local app.
Budget about an hour the first time; most of it is waiting on dashboards.

**Order matters.** Supabase first — the other two need its URL.

---

## The two-OAuth thing (read this first)

This app uses Twitch and Google for **two different purposes**, and mixing
them up is the single most common way to get stuck:

| | Purpose | Configured in | Redirect URI |
| --- | --- | --- | --- |
| **Sign-in** | Log *into* BrandCMD with your Google/Twitch account | Supabase dashboard | `https://<ref>.supabase.co/auth/v1/callback` |
| **Connection** | Pull *analytics* from your Twitch/YouTube channel | Backend `.env` | `<BACKEND_URL>/connect/<platform>/callback` |

You can use **one OAuth app per provider for both jobs** — just register
both redirect URIs on it. That's what this guide does.

Sign-in is optional; email/password works without it. Connections are the
whole point of the product.

---

## 1. Supabase

### 1a. Create the project

1. Go to <https://supabase.com> → **Sign in with GitHub**.
2. **New project**:
   - **Name:** `brandcmd`
   - **Database password:** generate one and **save it in your password
     manager now**. Supabase shows it once. You don't need it for this app
     (the service role key is what the backend uses), but you'll want it if
     you ever connect with `psql`.
   - **Region:** whichever is closest to you.
3. Wait ~2 minutes for provisioning.

### 1b. Run the migrations

**SQL Editor** (left sidebar) → **New query**. For each file in
`database/migrations/`, paste the whole file and click **Run**:

| # | File | Notes |
| --- | --- | --- |
| 1 | `001_initial_schema.sql` | Tables, enums, indexes |
| 2 | `002_rls_policies.sql` | Row-level security |
| 3 | `003_functions.sql` | Helper functions |
| 4 | `004_triggers.sql` | Auto-create profile on signup |
| 5 | `005_add_twitch_platform.sql` | **Run alone.** See below |
| 6 | `006_goals_and_onboarding.sql` | **Run after 005 completes** |

> **Why 005 and 006 must be separate runs:** 005 adds `twitch` to the
> `platform_type` enum. Postgres will not let a new enum value be *used*
> until the transaction that added it has committed — and 006 uses it. Paste
> them together and 006 fails with `unsafe use of new value "twitch"`.
> Run 005, wait for "Success", then run 006.

**Verify:** Table Editor should show `profiles`, `platform_tokens`, `goals`,
`oauth_states`, `analytics_cache`, `api_usage_log`.

### 1c. Grab your keys

**Settings → API**. You need three values:

| Value | Goes to | Notes |
| --- | --- | --- |
| **Project URL** | `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` | e.g. `https://abcdefgh.supabase.co` |
| **anon / public key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe in the browser |
| **service_role key** | `SUPABASE_SERVICE_ROLE_KEY` | **Backend only.** Bypasses all RLS |

> The `service_role` key must never appear in the frontend, in git, or in
> any `NEXT_PUBLIC_*` variable. Anything prefixed `NEXT_PUBLIC_` is compiled
> into the JavaScript bundle and is readable by anyone who visits the site.

### 1d. Auth URLs

**Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (change to your real domain later)
- **Redirect URLs:** add `http://localhost:3000/**`

Without this, the sign-in callback bounces users to the wrong host.

Your project ref is the subdomain of your Project URL — in
`https://abcdefgh.supabase.co`, the ref is `abcdefgh`. You need it below.

---

## 2. Twitch

### 2a. Register the app

1. <https://dev.twitch.tv/console/apps> → **Register Your Application**.
   (You'll need 2FA enabled on your Twitch account — it will make you do
   this first if you haven't.)
2. Fill in:
   - **Name:** must be **globally unique across all of Twitch**. `BrandCMD`
     is likely taken; try `BrandCMD by Gamergirllove`.
   - **OAuth Redirect URLs** — add all three (there's an "Add" button for
     each):
     ```
     http://localhost:8000/connect/twitch/callback
     https://<your-backend-domain>/connect/twitch/callback
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
     Skip the middle one for now if you haven't deployed; come back and add
     it later. The third one is only needed for "Sign in with Twitch".
   - **Category:** Analytics Tool
   - **Client Type:** **Confidential** ← this matters
3. **Create**.

> **Client Type must be Confidential.** A "Public" client is never issued a
> client secret, and this backend authenticates with one. If you pick Public
> you'll get to the token-exchange step and find there's no secret to copy.

### 2b. Get the credentials

Click **Manage** on your new app:

- **Client ID** → `TWITCH_CLIENT_ID`
- **New Secret** → `TWITCH_CLIENT_SECRET` (shown **once**; copy it now)

### 2c. Optional — Sign in with Twitch

Supabase dashboard → **Authentication → Providers → Twitch** → enable, paste
the same Client ID and Secret.

### Scopes this app requests

`user:read:email`, `channel:read:subscriptions`, `moderator:read:followers`

You don't configure these anywhere — the backend requests them at authorize
time. Worth knowing what they mean:

- `moderator:read:followers` is required to read your own follower **count**.
  Twitch tightened this in 2023; without it the followers endpoint returns
  nothing useful.
- `channel:read:subscriptions` only returns data for **Affiliates and
  Partners**. On a plain account the subscriptions endpoint returns 400 and
  the app records 0 subscribers. That's handled, not a bug.

---

## 3. Google Cloud (YouTube)

This is the fiddliest of the three. There's a real gotcha at the end — read
3d before you start connecting accounts.

### 3a. Create a project

1. <https://console.cloud.google.com> → project dropdown (top bar) → **New
   Project** → name it `brandcmd` → **Create**.
2. Make sure it's selected in the dropdown before continuing.

### 3b. Enable both APIs

**APIs & Services → Library**. Search for and **Enable** each:

- **YouTube Data API v3** — channel info, subscriber counts
- **YouTube Analytics API** — the daily time series

Both are required. Missing the second is a common cause of "it connects but
all the charts are empty."

### 3c. OAuth consent screen

**APIs & Services → OAuth consent screen**:

1. **User Type:** External → **Create**
2. **App information:** app name (`BrandCMD`), your support email, your
   developer contact email. Everything else can stay blank for now.
3. **Scopes:** **Add or Remove Scopes** → paste these into the manual field:
   ```
   https://www.googleapis.com/auth/youtube.readonly
   https://www.googleapis.com/auth/yt-analytics.readonly
   ```
4. **Test users:** **+ Add Users** → add **your own Google address**, and any
   other account you want to connect.

### 3d. The Testing-mode gotcha

Your consent screen starts in **Testing** status. That means:

- **Only the accounts you listed as test users can connect.** Anyone else
  gets "app has not completed verification" and is blocked. Max 100 testers.
- **Refresh tokens expire after 7 days.** Testers must reconnect weekly.

For your own use and a small beta, Testing mode is fine — just add every
account you care about as a test user.

**To let the public connect YouTube, you must pass Google verification.**
`youtube.readonly` is a *sensitive* scope, so that means submitting a
privacy policy URL, a verified domain, and a demo video, then waiting —
often **several weeks**. Start it early if a public launch is the plan. This
is Google's process; nothing in this codebase changes it.

### 3e. Create the credentials

**APIs & Services → Credentials → + Create Credentials → OAuth client ID**:

- **Application type:** Web application
- **Name:** `BrandCMD backend`
- **Authorized redirect URIs** — add:
  ```
  http://localhost:8000/connect/youtube/callback
  https://<your-backend-domain>/connect/youtube/callback
  https://<your-project-ref>.supabase.co/auth/v1/callback
  ```
- **Create** → copy **Client ID** → `GOOGLE_CLIENT_ID` and **Client
  secret** → `GOOGLE_CLIENT_SECRET`

> Google matches redirect URIs **exactly** — protocol, host, port, path,
> trailing slash. `http://localhost:8000/connect/youtube/callback/` (trailing
> slash) is a *different* URI and will fail with `redirect_uri_mismatch`.
> That error almost always means a character-level mismatch here.

### 3f. Optional — Sign in with Google

Supabase dashboard → **Authentication → Providers → Google** → enable, paste
the same Client ID and Secret.

---

## 4. Wire up the environment

### Backend — `backend/.env`

```bash
cd backend
cp .env.example .env
```

```ini
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key from 1c>

FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

SECRET_KEY=<any long random string>
TOKEN_ENCRYPTION_KEY=<generate below>

TWITCH_CLIENT_ID=<from 2b>
TWITCH_CLIENT_SECRET=<from 2b>

GOOGLE_CLIENT_ID=<from 3e>
GOOGLE_CLIENT_SECRET=<from 3e>
```

Generate the encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> **Save `TOKEN_ENCRYPTION_KEY` somewhere safe.** It encrypts every stored
> platform token. Change or lose it and every connection becomes unreadable
> — the app stays up and shows those platforms as disconnected, but every
> user has to reconnect.

The variable is `GOOGLE_CLIENT_ID`, not `YOUTUBE_CLIENT_ID` — the config
accepts either, but the example file uses the Google names to match what
Google's console calls them.

### Frontend — `frontend/.env.local`

```bash
cd frontend
cp .env.local.example .env.local
```

```ini
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from 1c>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_*` values are baked in at build time, so restart `npm run dev`
after changing them — a hot reload won't pick them up.

---

## 5. Run it

Two terminals:

```bash
# terminal 1
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt
uvicorn main:app --reload
```

```bash
# terminal 2
cd frontend
npm install
npm run dev
```

**Check <http://localhost:8000/health>** — it lists which platforms have
usable credentials:

```json
{"status":"ok","version":"1.0.0","platforms_configured":["twitch","youtube"]}
```

If `platforms_configured` is empty or missing one, the `.env` isn't being
read. Confirm the file is at `backend/.env` and restart uvicorn.

Then open <http://localhost:3000>, sign up, and walk the onboarding wizard.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `redirect_uri_mismatch` | The registered URI doesn't match byte-for-byte. Check protocol, port, trailing slash. `BACKEND_URL` must have no trailing slash. |
| `unsafe use of new value "twitch"` | Migrations 005 and 006 ran in one transaction. Run them separately. |
| "app has not completed verification" | That Google account isn't a test user. Add it in the consent screen. |
| Connects, but all charts are empty | YouTube Analytics API not enabled, or the channel genuinely has no data in the window. |
| Twitch shows 0 subscribers | Expected on a non-Affiliate account. |
| Every page bounces to `/login` | Supabase URL/anon key wrong, or Site URL not set (step 1d). |
| CORS errors in the console | `FRONTEND_URL` in the backend `.env` doesn't match where the frontend is served from. |
| `NEXT_PUBLIC_API_URL is not set` | Missing `.env.local`, or dev server not restarted after creating it. |
| Supabase queries suddenly fail | Free-tier project paused after 7 days idle. Resume it in the dashboard. |

---

## Going to production

When you deploy, redo these three:

1. Set `BACKEND_URL` to the deployed API URL and `FRONTEND_URL` to the
   deployed site URL.
2. **Add the production redirect URIs to both Twitch and Google.** They're
   derived from `BACKEND_URL`, so they change when you deploy.
3. Update Supabase **Site URL** and **Redirect URLs** to the real domain.

Since this is a monorepo, set the deploy root directory per service —
`frontend/` for Netlify or Vercel, `backend/` for Render or Railway.
Deploys pointed at the repo root will not find a project to build.
