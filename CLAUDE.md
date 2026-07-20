# Nested NYC

A student-only project network for NYC universities, live at **[nested.social](https://nested.social)** — production deploys from `main` via Vercel. Students discover projects, post their own, recruit teammates, browse campus events, and connect with each other; student orgs get accounts to host events.

## Tech stack

- **React 18 + Vite 5** — plain JSX, no TypeScript
- **Hand-rolled CSS** — design tokens in `src/design/styles.css`; **no Tailwind**. Vendor prefixes come from esbuild during the Vite build — no autoprefixer.
- **Supabase** — Postgres, Auth, Storage, RLS, Realtime
- **Vercel** — hosting + Web Analytics (`<Analytics />` in `App.jsx`)

## Architecture

Render path: `src/main.jsx` → `src/App.jsx` → `src/design/NestedApp.jsx`. **The live client app is `src/design/` + `src/services/` + `src/lib/supabase.js` — nothing else in `src/`.** (Server-side code lives in `api/` — see the Serverless layer section.)

- `main.jsx` imports `design/styles.css` and side-loads `utils/migrateLocalStorage` (console-only helper exposing `window.migrateToSupabase`).
- `App.jsx` fails loud if a prod build is missing Supabase env vars, wraps the app in `design/ErrorBoundary`, and mounts Vercel `<Analytics />` (which auto-instruments `pushState`, so per-URL pageviews work).
- `NestedApp.jsx` (~780 lines) is the **composition root**: boot parse, the string-route state machine + URL mirror, the cross-domain hydration barrier, hook wiring, and shell dispatch. Domain logic lives in `src/design/hooks/` (`useToasts`, `useSession`, `usePeople`, `useMessaging`, `useProjects`, `useEvents`, `useOrg`); NestedApp calls each hook in that order (TDZ-safe: `usePeople` before `useMessaging`, which consumes `people`), injects its cross-domain deps as one args object, and passes everything the renders need to `src/design/shells/` (`FullScreens`, `OrgShell`, `StudentShell`) through a single flat `api` bag that each shell destructures. **Hooks never import each other** — anything cross-domain flows through NestedApp explicitly; `signOut` is the root composer of `signOutAuth()` + every domain's `reset*()` + the router-param clears. Identity installs (onboarding completion, org create / edit-save) go through `useSession`'s `adoptProfile`/`adoptOrgAccount`, which write the state and its mirror ref **together** so a same-tick `applyParsed` can never role-gate against a stale identity — the raw setters deliberately don't leave the hook. The dispatch **guards** (skeleton holds, the edit/eventEdit bounce corrections) deliberately stay in NestedApp: they set state during render and arm the mirror's one-shot flags, which only works from the component that owns them. New domains ship as a hook; new screens render in a shell with their inputs added to the `api` bag — never as inline additions to NestedApp.

### URL routing — a mirror, not a router

The `route` state stays the source of truth; `src/design/router.js` (pure, zero deps) is the codec between that state and the address bar. NestedApp integrates it at exactly three points:

1. **Boot parse** — initial state is seeded from `parse(location)`. The boot never role-gates (the cached blob can't identify org owners); `hydrateSession` re-parses the URL at resolve time and corrects via `replaceState`.
2. **Write-only sync effect** — runs on every commit (deliberately no dep array — one-shot refs must be consumed by the *next* commit), builds the canonical path, sets `document.title`, and `pushState`s navigations / `replaceState`s corrections.
3. **popstate listener** — Back/Forward re-parse the URL through `applyParsed`, which role-gates via `accessOf` (guest→gated stashes a returnTo and shows the auth wall; org↔student URLs bounce to their home).

URL scheme: `/` (discover) · `/events[/:id]` · `/projects/:id[/edit]` · `/create` `/people` `/saved` `/notifications` `/profile` · `/messages[/:username]` (inbox / open thread) · `/u/:username` · `/org/:slug` (an org owner's own slug upgrades to `orgPublic`) · `/login` `/signup` `/forgot` `/org/signup` `/org/onboarding` · `/dashboard`, `/dashboard/edit`, `/dashboard/events/new`, `/dashboard/events/:id/edit` · `/auth/*` is reserved for Supabase email links (never routed; `?next=` is validated by `validateNext` against open redirects). `soon` has no URL. Unknown paths land on discover with the bar replaced to `/`.

Deep-linked projects absent from the feed cold-load via `projectService.getProject` (`detailFetch` state: loading → skeleton, missing → empty state); org event edits wait on `orgEventsLoading` instead of bouncing. `returnTo` (sessionStorage, re-validated on read) survives the signup email round-trip as `?next=` on `emailRedirectTo`.

### Views

- Student: `discover` `events` `detail` `people` `saved` `notifications` `messages` `messageThread` `profile` `userProfile` `create` `edit` `eventDetail` `onboarding` `forgot` `soon`
- Org: `orgSignup` `orgOnboarding` `orgDashboard` `orgEditMe` `orgPublic` `orgView` `eventCreate` `eventEdit`

Access classes live in router.js (`accessOf`): **public** (discover, events, eventDetail, detail, orgView) renders for anonymous visitors; **student** / **org** routes gate via `applyParsed` (deep link → returnTo stash → auth wall) and gated *actions* toast + `requireAuth` to `onboarding`; **anon** routes (auth screens) bounce signed-in users home.

### Data flow

**Supabase is the source of truth.** Screen components are presentational; all state is owned by `NestedApp` and the domain hooks it composes (screens still receive everything as props from the shell), which call `src/services/*`, convert rows through the adapters, and surface every failure as a toast (services never throw). The signed-in initial load stays a single `Promise.all` barrier in NestedApp; domain hooks expose the few setters it hydrates (e.g. `setInbox`/`setBlocked`) plus a `reset*()` that `signOut` composes into its full state wipe.

`localStorage["nested.nyc.v1"]` is only a light identity cache — `{ profile, joinedAt }`. Position lives in the URL: reload restores whatever the address bar says, and reopening bare `nested.social` lands on Discover.

### Auth

- Client: implicit flow, `persistSession`, `detectSessionInUrl` (`src/lib/supabase.js`, which exports the client + `authService`).
- **Students must use a supported NYC-university email** — not just any `.edu`: since `20260625000002` the `handle_new_user` trigger checks a domain **allowlist** (`is_supported_edu_email`: the `UNIVERSITIES[].domain` entries from `data.js`, exact or subdomain match — keep the SQL list in sync with `data.js`). Mirrored client-side by `authService.validateEduEmail`; `account_type = 'org_admin'` signups are exempt and existing users are grandfathered.
- **Orgs** sign up via `authService.signUpAsOrg()` (no `.edu` requirement) and land on `orgDashboard`.
- Supabase emails (confirm / magic link / recovery) link to `/auth/confirm` and `/auth/reset`, optionally carrying `?next=<internal path>` (signup forwards a stashed returnTo; org signup sends `next=/org/onboarding`). These are **not React routes** — the SPA fallback serves the app, the boot parse freezes the URL mirror (`authCallbackRef`), `detectSessionInUrl` consumes the token hash, and `hydrateSession()` routes the fresh session: validated `next` → that page; org owner → `orgDashboard`; mid-onboarding → `onboarding`/`orgOnboarding`; otherwise the URL/`/`. Dead links toast and fall home. **Prod requires** Supabase Auth → URL Configuration → Redirect URLs to cover `https://nested.social/*`, else GoTrue drops the `?next=` param.
- Supported methods: email + password, magic link / 6-digit OTP, password reset.

### Realtime

Four channels, all authed via `supabase.realtime.setAuth` before subscribing (RLS hides rows from an unauthed socket); no-ops in mock mode:

- `tm-self-<uid>` — postgres_changes on `team_members` filtered `user_id=eq.<me>`: join-request approvals/rejections update Requests / My projects live, no refetch.
- `dm-self-<uid>` — postgres_changes INSERT on `messages` filtered `recipient_id=eq.<me>`. The row's `body_enc` is ciphertext, so this is a **ping only** — the handler never reads the payload body; it refetches through the decrypting RPCs (open thread merges in place, anything else refreshes the inbox). Resyncs on socket rejoin, tab refocus, and browser `online`.
- `dm-readsync:<uid>` — broadcast: when I read a thread in another tab, this tab clears that peer's unread badge.
- `dm-receipts:<pair>` — per-conversation broadcast of ephemeral "read up to `<t>`" pings so the sender's bubbles flip to "Seen" instantly; the persistent `read_at` stays the source of truth for unread counts.

## Source map

```
src/
├── design/              # THE live app — every screen the user sees
│   ├── NestedApp.jsx    # composition root: route machine, URL mirror, hydration barrier, hook wiring, dispatch, TWEAK_DEFAULTS
│   ├── hooks/           # domain hooks: useToasts useSession usePeople useMessaging useProjects useEvents useOrg
│   ├── shells/          # render frames fed by the api bag: StudentShell, OrgShell, FullScreens (auth/create/edit routes)
│   ├── router.js        # pure URL codec: parse/build/accessOf/validateNext/titleFor
│   ├── discover.jsx detail.jsx create.jsx edit.jsx projectForm.jsx
│   ├── events.jsx eventDetail.jsx eventForm.jsx
│   ├── people.jsx profile.jsx matches.jsx notifications.jsx   # matches.jsx renders the "saved" view
│   ├── messages.jsx messageThread.jsx messageAttachments.jsx  # DM inbox / open thread / attachment UI
│   ├── peopleRank.js    # pure ranking for People → Browse ordering (completeness + relevance)
│   ├── headerMenus.jsx  # desktop topbar popovers (bell + account chip); mobile uses the account sheet
│   ├── userProfile.jsx  # /u/:username — self-fetching student profile page
│   ├── onboarding.jsx forgot.jsx                              # student auth screens
│   ├── org*.jsx                                               # org account screens
│   ├── shared.jsx       # shared UI primitives
│   ├── icons.jsx        # custom SVG icon set — do NOT add lucide
│   ├── data.js          # taxonomy constants (CATEGORIES, UNIVERSITIES, MAJORS,
│   │                    #   SKILLS, EVENT_TYPES…) — NOT mock data
│   ├── *Adapter.js      # pure DB-row ↔ UI-shape transforms (project/profile/people/message)
│   ├── styles.css       # all styling: tokens, surfaces, responsive rules
│   ├── accents.js       # accent palette — prod resolves the active accent from it; the dev panel offers it as swatches
│   ├── storageKeys.json # localStorage key(s), shared with scripts/smoke-refactor.cjs
│   ├── tweaks-panel.jsx # dev-only live design-token editor
│   └── ErrorBoundary.jsx
├── services/            # Supabase data access — ALL return { data, error }, never throw
├── lib/supabase.js      # client + authService
├── config/features.js   # SHOW_TWEAKS (= import.meta.env.DEV) — the only flag
└── utils/migrateLocalStorage.js  # console-only migration helper (side-loaded by main.jsx)
```

Services: `profileService` (own/public profiles, upsert), `projectService` (discover feed, CRUD, join requests, approve/reject), `eventService` (events + RSVPs), `orgService` (orgs by slug/id, members), `connectionService` (directed student→student connects), `messageService` (DM inbox/thread/send/block behind the SECURITY DEFINER RPCs; maps PT4xx `error.code`s to friendly messages; signs `dm-attachments` paths into 1-hour URLs), `storageService` (photo uploads), `lookupService` (username/email availability). Import services directly from their files — `services/index.js` is itself unused (nothing imports it).

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
| `messages` | 1:1 DMs — client-supplied UUID PK (the idempotency key, deliberately no default), `body_enc` encrypted at rest, `read_at` |
| `message_attachments` | child of `messages`: storage path, mime, size, filename; participant-read RLS |
| `blocks` | directed blocker→blocked pairs (PK `blocker_id, blocked_id`); blocks DMs in both directions |
| `conversation_clears` | per-user "delete chat" watermark — hides messages ≤ `cleared_at` for the caller only, peer unaffected |
| `message_notify_log` | once-ever unordered-pair log: first-DM email dedupe + per-sender hourly spray cap (service-role only) |
| `connection_notify_log` | once-ever source→target log so connect/disconnect/reconnect churn can't re-email (service-role only) |
| `rate_limits` | generic per-IP counters for the `api/` layer via `rate_limit_hit()` (service-role only) |

(`nests` / `nest_members` were dropped in `20260606000000`.)

- **Storage**: buckets `avatars` and `project-icons` — public read; authed users can write/delete only inside their own `${auth.uid()}/` folder. `dm-attachments` is **private** (10 MB/file + mime allowlist enforced by Storage itself): path is `<sender_uid>/<message_id>/<file>`, own-folder upload/delete, participant-only read, rendered client-side via 1-hour signed URLs.
- **RPCs**: `check_username_available` (anon pre-signup check), `check_email_exists` (**no longer anon-callable** — EXECUTE revoked in `20260625000001`; only the per-IP-rate-limited `/api/check-email` proxy calls it with the service-role key), `is_org_member`, `is_org_owner`, `is_connected_to`, `is_blocked_with`, `is_supported_edu_email`, `rate_limit_hit` (service-role only). All DM reads/writes go through SECURITY DEFINER RPCs: `send_message`, `get_thread`, `get_inbox`, `mark_thread_read`, `block_user`, `unblock_user`, `delete_conversation` — they raise PT401/PT403/PT422/PT429 SQLSTATEs, which PostgREST maps to those HTTP statuses and the services branch on `error.code`.
- **Triggers worth knowing**: `handle_new_user` (creates the profile row, enforces the university-domain allowlist for students), `profile_lock_account_type` + `org_lock_verified` (privilege fields can't be self-escalated), `sync_avatar_from_photos`, attendee/`updated_at` counters, and the BEFORE INSERT rate limiters `rl_team_members` / `rl_connections` / `rl_event_registrations` / `rl_events` (rolling-window caps → PT429).
- **RLS posture**: anon can read published projects, approved team members, the `public_profiles` view, and verified orgs/events. Authenticated profile reads are relationship-scoped (self, connections, teammates). Writes are self-scoped; event creation requires verified-org membership. DM tables are locked harder: direct DML is REVOKEd from `authenticated` — the DEFINER RPCs are the only write path, so idempotency, block checks, and rate limits can't be bypassed.
- **Realtime publication**: `team_members` and `messages`.

### Direct messages (DMs)

1:1 student↔student chat at `/messages`, built as migrations `20260621`–`20260628`. Key semantics:

- **No connection required** (`20260627000000`): any authenticated student can DM any student (the old connection gate was self-satisfiable — connects are unilateral). Blocks still stop sends in both directions, and the RPC verifies the recipient is a real student account.
- **Encrypted at rest** (`20260623000000`): bodies are `pgp_sym_encrypt`-ed inside the RPCs with a 256-bit key in Supabase Vault (`dm_body_key`, never in git). Realtime payloads are therefore ciphertext — the client treats INSERT events as pings and refetches via RPC (see Realtime).
- **Idempotent sends**: `messages.id` is client-generated (`messageService.newId()`); a retried send reuses the id and lands on `ON CONFLICT DO NOTHING` instead of minting a duplicate.
- **Limits** (client-mirrored in `messageService`, enforced in the RPC): 4,000-char body, ≤5 attachments × 10 MB, 10 sends / 10 s (PT429).
- **Delete conversation** is delete-for-me only: a `conversation_clears` watermark hides older messages from the caller; the peer keeps their copy and the thread reappears if they message again.
- Read receipts: persistent `read_at` via `mark_thread_read`; live "Seen" + cross-tab unread clearing ride the broadcast channels.

### Email notifications (transactional)

Row changes fan out to transactional emails via **Supabase Database Webhooks** — pg_net triggers on `team_members`, `connections`, `organizations`, and `messages` — which POST a `{type, table, record, old_record}` payload to **`/api/notify`** (a Vercel function; `api/notify.js`). It renders the shared template (`api/_email/template.js`) and sends through **Resend**. Recipient addresses come from `auth.users` via a service-role lookup (not `profiles`); `profiles.email_opt_out` suppresses delivery. One-click unsubscribe is `/api/unsubscribe` (GET is read-only so `.edu` link-prefetch scanners can't opt people out; POST applies). The trigger fn is exception-wrapped, so a webhook failure can never break the underlying write. Setup + the Vercel env vars it needs: **`EMAIL_NOTIFICATIONS.md`**.

The five sends and the exact event each requires:
- `team_members` INSERT with `status='pending'` → "join request" → project owner + co-leads (`projects.admins`)
- `team_members` UPDATE to `status='approved'` → "you're in" → the requester
- `connections` INSERT → "new connection" → the target
- `organizations` UPDATE flipping `verified` false→true → "you're verified" → the owner (`owner_user_id`)
- `messages` INSERT, **first message of a pair only** → "new message" → the recipient. Throttled in `api/notify.js` (`planNewMessage`): emails only when no earlier message exists for the unordered pair, deduped via `message_notify_log`, capped 100/hr per sender — **not** an email per message.

> ⚠️ **Never bulk-update `team_members`, `connections`, or `organizations` without first disabling `zz_email_notify`.** The triggers react to the *event*, not the row's age, so any backfill / admin script that matches a guard sends one real email per affected row — e.g. mass-setting `organizations.verified = true` emails every owner; bulk-flipping `team_members` to `approved` emails every requester. Recipe: `ALTER TABLE public.<table> DISABLE TRIGGER zz_email_notify;` → run the batch → `… ENABLE TRIGGER zz_email_notify;`. (Pre-existing rows are always safe — triggers only fire on DML made *after* they were created, so there is no retroactive blast.) The `messages` first-message webhook is throttled (one email per new pair, ever), but a **bulk INSERT / restore into `messages`** would still fire one email per genuinely-new pair — disable that webhook before any such batch too.

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
2. Put its state + handlers in the owning domain hook (`src/design/hooks/` — new domain → new hook, injected deps in, `{state, handlers, reset*}` out; wire `reset*` into NestedApp's `signOut`).
3. Render it in the right shell (usually `shells/StudentShell.jsx`): `route === "myScreen" && <MyScreen … />`, and add any new inputs it needs to the `api` bag in NestedApp.
4. Navigate with `setRoute("myScreen")`.
5. Give it a URL: add a row to `ROUTES` in `router.js` (path pattern, access class, param→state map) and a `BUILD` entry; param state must be set before/with `setRoute` so the mirror can build the path (router params are `useState`s in NestedApp). Pick access `public` only if it should be anonymously browsable.
6. Add a `titleFor` case for the tab title.

### Naming

`get*` fetches · `on*` handlers · `set*` state setters · `to*`/`from*` adapter transforms · `validate*` checks.

## Development

```bash
npm install
npm run dev        # localhost:5173
npm run build      # production build → dist/
npm run preview
npm test           # node --test: router.test.js + messageAdapter.test.js + data.test.js
```

- Env (`.env`, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Local Supabase stack via the CLI/Docker (`supabase/config.toml`): API :54321, DB :54322, Studio :54323; email confirmations auto-pass locally.
- **Tests cover only the pure modules** (`router.js`, `messageAdapter.js`, and `data.js`'s `resolveOrgUniSlug`) via `node --test` — no framework. Everything else is verified manually in the browser (Playwright is a devDependency for ad-hoc verification scripts, not a checked-in suite).

## Deployment

Vercel, auto-deploy from `main`. `public/robots.txt` is fully permissive (Google + AI crawlers welcome; profile privacy rests on the auth gate, not robots) and is served as a static file ahead of the SPA rewrite. `vercel.json` provides the SPA fallback rewrite plus security headers (HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy; CSP is currently **report-only**). Env vars are set in the Vercel dashboard.

### Serverless layer (`api/`)

- `notify.js` — email-notification webhook target (see Email notifications).
- `unsubscribe.js` — one-click email opt-out (GET read-only, POST applies).
- `check-email.js` — per-IP-rate-limited proxy for the email-existence signup hint (fails open to `{ exists: false }`; 404s harmlessly under plain `vite` dev).
- `prerender.js` — per-entity `<head>` injection (title / OG / canonical / JSON-LD) for the public entity routes, served to bots and humans alike; reads with the **anon** key so RLS keeps private rows out of cacheable HTML. Must start from the freshly built `dist/index.html` (bundled via `vercel.json` `includeFiles`).
- `sitemap.js` — dynamic `/sitemap.xml` (rewritten there by `vercel.json`; anon-key reads only emit publicly visible URLs).
- `_rate-limit.js` + `_email/template.js` — shared helpers; the leading underscore keeps Vercel from routing them.

## Legacy code

The legacy routed frontend (`src/pages/`, `src/components/`, the React Router/Tailwind era) was **deleted 2026-06-09** after an import-graph trace + production-bundle check proved none of it was reachable; the bundle hash was identical before and after. It lives only in git history now — the repo contains live code only.

Untracked local dirs (`social/`, `insta/`, `insta-reel/`) are content/marketing tooling, not app code.
