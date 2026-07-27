# BrandCommand

A creator intelligence platform. Connect Twitch and YouTube, see your
audience, engagement and revenue metrics in one command center, and track
growth goals against live data.

```
┌──────────────┐   Supabase JWT   ┌──────────────┐   OAuth   ┌───────────────┐
│   frontend   │ ───────────────▶ │   backend    │ ────────▶ │  Twitch API   │
│  Next.js 14  │                  │   FastAPI    │           │  YouTube API  │
└──────┬───────┘                  └──────┬───────┘           │  + 7 others   │
       │                                 │                   └───────────────┘
       │ auth only                       │ service role
       └────────────▶ ┌──────────────────▼─┐
                      │  Supabase Postgres │
                      └────────────────────┘
```

| Folder | What it is | Deploys to |
| --- | --- | --- |
| [`backend/`](backend) | FastAPI service — OAuth, encrypted token storage, analytics normalization | Render / Railway / Fly |
| [`frontend/`](frontend) | Next.js 14 App Router dashboard | Netlify / Vercel |
| [`database/`](database) | Supabase migrations, seed data, setup guide | Supabase |

Each folder has its own README with setup details. Start there.

---

## Why the layers must agree

The backend and frontend are separate deployments, and their contract lives
in exactly two places:

- **`backend/app/services/base.py`** — every platform integration implements
  `get_auth_url`, `exchange_code`, `refresh_token`, `get_profile`,
  `get_analytics`. The routers are platform-agnostic; adding a provider
  means adding a service, not editing a router.
- **`frontend/src/lib/api.ts`** — the only place the frontend talks to the
  API, and the only place snake_case is mapped to camelCase. Components
  never call `fetch` directly.

Change one side of either boundary and check the other. An earlier version
of this project drifted at exactly these seams — the frontend called routes
the backend never served, and the analytics router called service methods
that did not exist.

---

## Quick start

You need a Supabase project, and Twitch + Google OAuth apps. All three are
free.

**→ [SETUP.md](SETUP.md) walks through all of it step by step**, including
the gotchas that will otherwise cost you an afternoon: why migrations 005
and 006 must run separately, why Twitch's client type must be Confidential,
and why Google's Testing mode blocks everyone who isn't a listed test user.

```bash
git clone https://github.com/Gamergirllove/brandcmd.git
cd brandcmd
```

**1. Database**

Create a project at [supabase.com](https://supabase.com), then apply the
migrations in order. Run `005` and `006` separately — Postgres will not let
a newly added enum value be used until the transaction adding it commits.
See [`database/README_DATABASE.md`](database/README_DATABASE.md).

**2. Backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows; source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt
cp .env.example .env            # fill in Supabase + OAuth credentials
uvicorn main:app --reload
```

`GET /health` lists which platforms have usable credentials — the fastest
way to confirm your environment is wired up.

**3. Frontend**

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in
npm run dev
```

---

## OAuth redirect URIs

Register this exact URL with each provider — it must match byte-for-byte at
both authorize and exchange time:

```
${BACKEND_URL}/connect/<platform>/callback
```

Locally that is `http://localhost:8000/connect/twitch/callback`. In
production it is your deployed backend URL, so **re-register these whenever
`BACKEND_URL` changes.**

---

## Tests

```bash
cd backend  && .venv/Scripts/python -m pytest    # 89 tests, no network needed
cd frontend && npm run build                     # also typechecks and lints
```

Backend tests run against mocked HTTP and an in-memory Supabase stand-in.
They do not prove the integrations work against real Twitch or YouTube
accounts — that needs a live connection through the app.

---

## Status

Working end to end: auth, onboarding, connecting platforms, the analytics
dashboard, and goals.

Not built yet: Reports and Notifications, which appear in the sidebar
marked "Soon" rather than as dead links. The Notion program doc lists a
broader module set than what exists here.
