# BrandCommand Frontend

Next.js 14 (App Router) dashboard for BrandCommand — the creator command
center. Dark HUD-styled UI over live analytics from the BrandCommand API.

---

## Architecture

```
browser ──▶ Next.js (this app) ──(Supabase JWT)──▶ BrandCommand API ──▶ platforms
              │
              └──(auth only)──▶ Supabase
```

- **Auth** is Supabase, using `@supabase/ssr` so the session lives in
  cookies. That is what lets `middleware.ts` see the session and guard
  routes server-side. Use `supabase` from `@/lib/supabase` in client
  components and `createSupabaseServerClient()` from
  `@/lib/supabase-server` in route handlers.
- **Data** comes from the API, never from Supabase directly. All requests
  go through `@/lib/api`, which attaches the bearer token and maps the
  API's snake_case onto the camelCase types in `@/types`.
- **Hooks** in `@/hooks/useAnalytics` (`useAnalytics`, `useConnections`,
  `useGoals`, `useProfile`) wrap that client with loading/error/refetch.

Components never call `fetch` directly — add a function to `lib/api.ts`
instead, so the wire format stays in one place.

---

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill it in
npm run dev
```

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key only — never the service role key |
| `NEXT_PUBLIC_API_URL` | Backend origin, no trailing slash |

All three are inlined at build time, so they must be present when
`next build` runs, not only at runtime. The app fails fast at startup if
the Supabase values are missing.

The backend derives its CORS allow-list from its own `FRONTEND_URL`, so
that must match wherever this app is served from.

---

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Marketing landing page |
| `/login`, `/signup` | Email + OAuth (Google, Twitch) auth |
| `/onboarding` | 5-step wizard: identity, creator type, connect Twitch, connect YouTube, first goal |
| `/dashboard` | Totals, daily views chart, per-platform cards |
| `/analytics` | Per-platform metrics, daily views, engagement breakdown |
| `/connect` | Connect and disconnect platforms |
| `/goals` | Create, edit and track goals |
| `/settings` | Profile, connections, notification preferences, account deletion |

`middleware.ts` guards everything except `/`, `/login` and `/signup`, and
redirects users who haven't finished onboarding back to the wizard.

Reports and Notifications appear in the sidebar marked "Soon" — the
backend for them doesn't exist yet, so they are deliberately not links.

### OAuth round trip

Connecting a platform leaves the app: the backend hands back a provider
URL, the provider calls the backend, and the backend redirects here with
`?connected=<platform>` or `?error=<message>`. Pass `returnPath` to
`fetchConnectUrl` to come back somewhere other than `/connect` — the
onboarding wizard uses this to resume on the right step.

---

## Checks

```bash
npm run build     # also typechecks and lints
npx tsc --noEmit
npx next lint
```

---

## Deployment

`netlify.toml` is configured for Netlify with `@netlify/plugin-nextjs`.
Set the three `NEXT_PUBLIC_*` variables in the site's environment settings
— the build fails without them.
