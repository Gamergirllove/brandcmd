# BrandCommand API

FastAPI service that aggregates creator analytics across Twitch, YouTube,
Instagram, TikTok, X, Pinterest, LinkedIn, Facebook and Snapchat into one
set of endpoints.

It owns OAuth (authorization, token exchange, encrypted storage, refresh),
normalises each platform's metrics into a common shape, and exposes goals
and profile state for the frontend.

---

## Architecture

```
Next.js frontend  ──(Supabase JWT)──▶  this API  ──(OAuth)──▶  platform APIs
                                          │
                                          └──(service role)──▶  Supabase Postgres
```

- The frontend authenticates users with Supabase and sends the resulting
  access token as a bearer credential. `get_current_user` validates it and
  returns the user id.
- This service holds the Supabase **service role** key and is the only
  component that reads or writes `platform_tokens`.
- Access and refresh tokens are Fernet-encrypted before insert. Expiry,
  scope and the platform handle stay in the clear so they can be queried
  and displayed.

### Adding a platform

1. Add a service in `app/services/` subclassing `BasePlatformService`
   (`get_auth_url`, `exchange_code`, `refresh_token`, `get_profile`,
   `get_analytics`). Set `requires_pkce = True` if the provider needs it.
2. Register it in `app/services/platform_factory.py`.
3. Add its credential field names to `_CREDS_MAP` in
   `app/services/platform_router.py` and to `Settings` in `app/config.py`.
4. Add the value to the `platform_type` enum in a database migration.

No router changes are needed — `/analytics` and `/connect` are
platform-agnostic.

---

## Setup

```bash
python -m venv .venv
.venv/Scripts/activate      # Windows;  source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt
cp .env.example .env        # then fill it in
uvicorn main:app --reload
```

Interactive docs: <http://localhost:8000/docs>

`GET /health` lists which platforms have usable credentials — the fastest
way to confirm the environment is wired correctly.

### Required environment

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server-side only |
| `BACKEND_URL` | Public URL of this service; OAuth callbacks are derived from it |
| `FRONTEND_URL` | Where users are returned after connecting; also drives CORS |
| `TOKEN_ENCRYPTION_KEY` | Fernet key for token encryption (see below) |

Generate an encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Changing `TOKEN_ENCRYPTION_KEY` makes every stored token unreadable. The
app degrades gracefully — affected platforms simply read as disconnected —
but every user has to reconnect.

Platform credentials are optional per platform. An unconfigured platform
reports `configured: false` from `/connect/status` and the UI hides it.

### OAuth redirect URIs

Register this exact URL with each provider:

```
${BACKEND_URL}/connect/<platform>/callback
```

For example `https://brandcmd-backend.onrender.com/connect/twitch/callback`.
It must match byte-for-byte at both authorize and exchange time.

---

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness + configured platforms |
| `POST` | `/auth/refresh` | Exchange a Supabase refresh token |
| `GET` | `/connect/status` | Connection state for every platform |
| `GET` | `/connect/{platform}/url` | Begin authorization (`?return_path=` optional) |
| `GET` | `/connect/{platform}/callback` | Provider callback; redirects to the frontend |
| `DELETE` | `/connect/{platform}` | Disconnect |
| `GET` | `/analytics/overview` | Totals + per-platform breakdown (`?days=`) |
| `GET` | `/analytics/compare` | Side-by-side with metric leaders |
| `GET` | `/analytics/{platform}` | One platform, including its daily series |
| `GET` | `/goals` | Goals, current values refreshed from live data |
| `POST` | `/goals` | Create a goal |
| `PATCH` | `/goals/{id}` | Update target or completion |
| `DELETE` | `/goals/{id}` | Delete a goal |
| `GET` | `/profile` | Creator profile + onboarding state |
| `PATCH` | `/profile` | Update profile / notification preferences |
| `DELETE` | `/profile` | Delete the account and all its data |

All routes except `/health`, `/`, `/auth/refresh` and the OAuth callback
require `Authorization: Bearer <supabase-access-token>`.

### Failure behaviour

`/analytics/*` never fails because one provider is unhealthy. A platform
that errors comes back with `error` set and zeroed metrics; one whose
credentials can no longer be refreshed comes back with
`needs_reconnect: true`. The frontend renders both states explicitly.

---

## Tests

```bash
.venv/Scripts/python -m pytest
```

89 tests covering the Twitch integration (against mocked Helix responses),
token encryption and refresh, OAuth state handling, and the analytics,
goals and profile routers. No network or database access required.

---

## Deployment

Runs on any container/buildpack host. `Procfile` and `railway.json` are
included for Railway; Render and Fly work with the same start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set `BACKEND_URL` to the deployed URL and re-register the OAuth redirect
URIs with each provider whenever it changes.
