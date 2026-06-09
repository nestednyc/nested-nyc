# Nested NYC

A student-only project network for NYC universities, live at **[nested.social](https://nested.social)** — production deploys from `main` via Vercel. Students discover projects, post their own, recruit teammates, browse campus events, and connect with each other; student orgs get accounts to host events.

## Tech stack

- **React 18 + Vite 5** — plain JSX, no TypeScript
- **Hand-rolled CSS** — design tokens in `src/design/styles.css`; **no Tailwind**. Vendor prefixes come from esbuild during the Vite build — no autoprefixer.
- **Supabase** — Postgres, Auth, Storage, RLS, Realtime
- **Vercel** — hosting + Web Analytics (`<Analytics />` in `App.jsx`)

## Architecture

Render path: `src/main.jsx` → `src/App.jsx` → `src/design/NestedApp.jsx`. **The live app is `src/design/` + `src/services/` + `src/lib/supabase.js` — nothing else.**

- `main.jsx` imports `design/styles.css` and side-loads `utils/migrateLocalStorage` (console-only helper exposing `window.migrateToSupabase`).
- `App.jsx` fails loud if a prod build is missing Supabase env vars, wraps the app in `design/ErrorBoundary`, and mounts Vercel `<Analytics />`.
- `NestedApp.jsx` (~1,400 lines) is the app shell: all state, data loading, and a **string-based view state machine** (`useState(route)` + conditional renders). **There is no router and no URL-based navigation.**

### Views

- Student: `discover` `events` `detail` `people` `saved` `notifications` `profile` `create` `edit` `eventDetail` `onboarding` `forgot` `soon`
- Org: `orgSignup` `orgOnboarding` `orgDashboard` `orgEditMe` `orgPublic` `orgView` `eventCreate` `eventEdit`

`GUEST_ROUTES = {discover, events, detail}` (NestedApp.jsx:89): anonymous visitors can browse these; any other route falls back to `discover`, and gated actions toast + send the user to `onboarding` (auth).

### Data flow

**Supabase is the source of truth.** Screen components are presentational; `NestedApp` owns all state, calls `src/services/*`, converts rows through the adapters, and surfaces every failure as a toast (services never throw).

`localStorage["nested.nyc.v1"]` is only a light cache — `{ profile, route, detailId, editId, joinedAt }` — and only public routes are restored on reload.

### Auth

- Client: implicit flow, `persistSession`, `detectSessionInUrl` (`src/lib/supabase.js`, which exports the client + `authService`).
- **Students must use a `.edu` email** — checked client-side (`authService.validateEduEmail`) and enforced server-side (the `handle_new_user` trigger rejects non-`.edu` signups unless `account_type = 'org_admin'`).
- **Orgs** sign up via `authService.signUpAsOrg()` (no `.edu` requirement) and land on `orgDashboard`.
- Supabase emails (confirm / magic link / recovery) link to `/auth/confirm` and `/auth/reset`. These are **not React routes** — the SPA fallback serves the app, `detectSessionInUrl` + `onAuthStateChange` pick up the session, and `hydrateSession()` routes the user (org owner → `orgDashboard`, mid-onboarding student → `onboarding`, otherwise `discover`).
- Supported methods: email + password, magic link / 6-digit OTP, password reset.

### Realtime

One subscription: `team_members` filtered to `user_id=eq.<me>` (channel authed via `supabase.realtime.setAuth`), so join-request approvals/rejections by project owners update the UI live.

## Source map

```
src/
├── design/              # THE live app — every screen the user sees
│   ├── NestedApp.jsx    # shell: view state machine, data loading, TWEAK_DEFAULTS
│   ├── discover.jsx detail.jsx create.jsx edit.jsx projectForm.jsx
│   ├── events.jsx eventDetail.jsx eventForm.jsx
│   ├── people.jsx profile.jsx matches.jsx notifications.jsx   # matches.jsx renders the "saved" view
│   ├── onboarding.jsx forgot.jsx                              # student auth screens
│   ├── org*.jsx                                               # org account screens
│   ├── shared.jsx       # shared UI primitives
│   ├── icons.jsx        # custom SVG icon set — do NOT add lucide
│   ├── data.jsx         # taxonomy constants (CATEGORIES, UNIVERSITIES, MAJORS,
│   │                    #   SKILLS, EVENT_TYPES…) — NOT mock data
│   ├── *Adapter.js      # pure DB-row ↔ UI-shape transforms (project/profile/people)
│   ├── styles.css       # all styling: tokens, surfaces, responsive rules
│   ├── tweaks-panel.jsx # dev-only live design-token editor
│   └── ErrorBoundary.jsx
├── services/            # Supabase data access — ALL return { data, error }, never throw
├── lib/supabase.js      # client + authService
├── config/features.js   # SHOW_TWEAKS (= import.meta.env.DEV) — the only flag
└── utils/migrateLocalStorage.js  # console-only migration helper (side-loaded by main.jsx)
```

Services: `profileService` (own/public profiles, upsert), `projectService` (discover feed, CRUD, join requests, approve/reject), `eventService` (events + RSVPs), `orgService` (orgs by slug/id, members), `connectionService` (directed student→student connects), `storageService` (photo uploads), `lookupService` (username/email availability via RPCs). Import services directly from their files — `services/index.js` is itself unused (nothing imports it).

## Backend (Supabase)

Migrations live in `supabase/migrations/`, applied in order. ⚠️ Prod migrations have sometimes been applied out-of-band, so prod's `schema_migrations` can drift from this folder — verify actual prod state before trusting `supabase db push`.

| Table | Purpose |
|---|---|
| `profiles` | one row per auth user: identity, skills, photos, `account_type` (`student` / `org_admin`), links |
| `projects` | cork-board postings: category, stage/status, roles (JSONB), flyer styling (`pin_type`, `rot`, `flyer_color`) |
| `team_members` | join requests + team slots: `status` pending/approved/rejected, request `message` |
| `events` | campus events owned by orgs (`organization_id`), typed via `event_type` |
| `event_registrations` | RSVPs (user × event) |
| `organizations` | universities + clubs: unique `slug`, `verified` flag (admin-only) |
| `org_members` | org owner/admin junction |
| `connections` | directed student→student edges (PK `user_id, target_id`) |
| `saved_projects` | bookmarks (unique `user_id, project_id`) |

(`nests` / `nest_members` were dropped in `20260606000000`.)

- **Storage**: buckets `avatars` and `project-icons` — public read; authed users can write/delete only inside their own `${auth.uid()}/` folder.
- **RPCs**: `check_email_exists`, `check_username_available` (anon-callable pre-signup checks), `is_org_member`, `is_org_owner`.
- **Triggers worth knowing**: `handle_new_user` (creates the profile row, enforces `.edu` for students), `profile_lock_account_type` + `org_lock_verified` (privilege fields can't be self-escalated), `sync_avatar_from_photos`, attendee/`updated_at` counters.
- **RLS posture**: anon can read published projects, approved team members, the `public_profiles` view, and verified orgs/events. Authenticated profile reads are relationship-scoped (self, connections, teammates). Writes are self-scoped; event creation requires verified-org membership.
- **Realtime publication**: `team_members` only.

## Design language — "cork board"

Physical pinboard vocabulary: paper flyers pinned/taped to cork, slight per-card rotation (`rot` × `--tilt`), grain textures, category color coding.

- **Tokens** (styles.css): `--paper*`, `--cork*`, `--ink*`, `--line`, `--accent*`, category colors `--c-startup/--c-class/--c-hack/--c-side/--c-research`, fonts `--disp/--body/--mono`, `--radius`, `--shadow-*`.
- **Surface presets**: `cork` (default), `newsprint`, `riso`.
- **Fonts**: Bricolage Grotesque (display), Hanken Grotesk (body), Spline Sans Mono, Anton (alt display).
- **Desktop-first**, single mobile breakpoint at **860px** (mobile topbar, account sheet, stacked layouts).
- Dev-only **tweaks panel** (`SHOW_TWEAKS`) tunes surface/accent/font/texture/tilt live; production renders `TWEAK_DEFAULTS` from NestedApp.jsx.

### Rules

- Style with the CSS variables above — never hardcoded colors.
- Icons come from `design/icons.jsx` only.
- **New screens take zero visual cues from the deleted legacy UI** — cork-board vocabulary only.

### Adding a screen

1. Create `src/design/myScreen.jsx` (presentational; state and handlers come in as props).
2. Pick a route string and render it in NestedApp: `route === "myScreen" && <MyScreen … />`.
3. Navigate with `setRoute("myScreen")`.
4. Add to `GUEST_ROUTES` only if it should be anonymously browsable.

### Naming

`get*` fetches · `on*` handlers · `set*` state setters · `to*`/`from*` adapter transforms · `validate*` checks.

## Development

```bash
npm install
npm run dev        # localhost:5173
npm run build      # production build → dist/
npm run preview
```

- Env (`.env`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Local Supabase stack via the CLI/Docker (`supabase/config.toml`): API :54321, DB :54322, Studio :54323; email confirmations auto-pass locally.
- **No test suite** — verify changes manually in the browser.

## Deployment

Vercel, auto-deploy from `main`. `vercel.json` provides the SPA fallback rewrite plus security headers (HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy; CSP is currently **report-only**). Env vars are set in the Vercel dashboard.

## Legacy code

The legacy routed frontend (`src/pages/`, `src/components/`, the React Router/Tailwind era) was **deleted 2026-06-09** after an import-graph trace + production-bundle check proved none of it was reachable; the bundle hash was identical before and after. It lives only in git history now — the repo contains live code only.

Untracked local dirs (`social/`, `insta/`, `insta-reel/`) are content/marketing tooling, not app code.
