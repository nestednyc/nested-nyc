# Nested NYC — SEO Audit & Recommendations

**Date:** 2026-06-18
**Scope:** SEO posture of the live production site (`https://nested.social`) and the `nested-nyc` repo.
**Method:** Static review of the repo (`index.html`, `vercel.json`, `public/robots.txt`, `src/design/router.js`, `src/design/NestedApp.jsx`, `api/`) **plus live fetches of production** to confirm exactly what crawlers and link-unfurlers actually receive (repo and prod can drift).
**Changes made:** None. This is an audit only.

---

## TL;DR verdict

The static meta baseline is **above average for an SPA**, but the site is a **pure client-side-rendered (CSR) React app**, and that single fact caps almost all of its SEO ceiling. Production confirms it: **every URL serves a byte-identical HTML shell** with the same generic title and Open Graph tags. Concretely:

- Every shared link (project, event, org) shows the **same generic social preview** — "Nested NYC — a student-only project network" — because unfurlers don't run JS. For a network that grows by students sharing links, this is the **single highest-impact gap.**
- Deep public pages (`/projects/:id`, `/events/:id`, `/org/:slug`) are **only conditionally indexable** (Google renders JS on a lagging second pass; most other crawlers don't render JS at all) and have **no sitemap** advertising them — and navigation is state-driven (`setRoute`→`pushState`), so there's **no static link graph** for crawlers to follow into them either.
- **No `og:image`, no structured data (JSON-LD), no canonical tags, no valid `sitemap.xml`.**

None of this requires abandoning the SPA. The recommended fix is a **Vercel serverless meta/prerender layer** for the public entity routes (the repo already runs serverless functions against Supabase), plus a set of cheap static wins.

---

## Evidence: what production serves right now

Live fetch on 2026-06-18 (`Invoke-WebRequest`, no JS execution — i.e. exactly what a non-rendering crawler/unfurler sees):

| URL | Status | Bytes | Content-Type | `<div id="root">` |
|---|---|---|---|---|
| `https://nested.social/` | 200 | 1783 | text/html | **empty (pre-JS shell)** |
| `https://nested.social/events` | 200 | **1783 — byte-identical to `/`** | text/html | empty |
| `https://nested.social/robots.txt` | 200 | 23 | text/plain | — (real static file) |
| `https://nested.social/sitemap.xml` | **200** | **1783 — the SPA HTML shell, not XML** | **text/html** | empty |

Served `<head>` for **all** HTML routes (identical everywhere):

- `<title>Nested NYC</title>` — static; JS rewrites it post-hydration, but crawlers/unfurlers that don't run JS see this on every page.
- `<meta name="description">`, `og:type/og:site_name/og:title/og:description`, `twitter:card=summary`, `twitter:title/description` — all **generic site-level values**, present on every URL.
- **Absent:** `og:image`, `twitter:image`, `<link rel="canonical">`, any per-page values, any JSON-LD.
- Single bundle: `/assets/index-*.js` + `/assets/index-*.css` (no route-level code splitting).

**Two conclusions from this that the repo alone wouldn't prove:**

1. There is **no prerendering or per-route differentiation at the edge** — `/` and `/events` are the same bytes.
2. The SPA rewrite (`vercel.json` → `/((?!api/).*)` → `/`) **masks any non-existent static path as a 200 HTML page.** `/sitemap.xml` already demonstrates this. Implication: any new static SEO asset must exist as a real file in `public/` (the way `robots.txt` does) or be served by an `/api/*` function — otherwise the rewrite silently serves the SPA instead.

---

## What's already good (keep these)

- Solid **static meta baseline** in `index.html:8-17`: description, full Open Graph block, Twitter card, `theme-color`, `lang="en"`, responsive viewport.
- **Per-route `document.title`** via `router.js` `titleFor()` (`router.js:151-176`) driven by the URL-mirror effect (`NestedApp.jsx:263-268`), with dynamic titles for project / profile / org pages. (Helps Google after JS render and helps the browser tab — just not non-JS consumers.)
- **Clean, semantic, lowercase-canonicalized URLs** (`router.js` `ROUTES`, trailing-slash normalization at `router.js:63`).
- **Permissive `robots.txt`** and **HTTPS + HSTS** (`vercel.json`).
- **Open-redirect-safe `?next=` handling** (`validateNext`, `router.js:140-148`) — not SEO, but relevant to safe canonical/return handling.
- **Privacy posture is already correct** (see below): student profiles and all account routes are auth-gated, so they neither can nor should be indexed.

---

## The core constraint: CSR and who renders JavaScript

| Consumer | Runs JS? | What it sees today |
|---|---|---|
| **Googlebot** | Yes, but on a **deferred, resource-limited second wave**; render errors/timeouts → blank indexed | Eventually the rendered page, with lag; title/desc only ever the generic static ones unless JS-updated meta is added |
| **Bing / others** | Unreliable / largely no | The empty shell + generic meta |
| **Social & chat unfurlers** (Twitter/X, Facebook, LinkedIn, Slack, Discord, WhatsApp, iMessage, Telegram) | **No — never** | **Only** the static `<head>`: generic title, generic OG, **no image** |

Everything below follows from this table.

---

## Findings (prioritized)

| # | Finding | Severity | Effort | Where |
|---|---|---|---|---|
| F1 | Every shared link shows the **same generic social preview** (no per-URL OG) | **High** | Med | server-side |
| F2 | Deep public pages only conditionally indexable; **per-route `<meta>` never updates** (only `<title>` does) | **High** | Low (client) / Med (server) | `NestedApp.jsx`, server |
| F3 | **No valid `sitemap.xml`** — and the path is currently masked into HTML by the SPA rewrite | **High** | Low–Med | `public/` or `/api` + `vercel.json` |
| F4 | **No `og:image`**; `twitter:card` is the small `summary` | **Med** | Low (static) → Med (dynamic) | `index.html`, server |
| F5 | **No structured data (JSON-LD)** — Events lose Google rich-result / Events eligibility | **Med-High** | Low–Med | server (ideal) / client |
| F6 | **Soft-404s**: missing/unknown entity URLs return `200` + shell | **Med** | Med | server |
| F7 | **No `<link rel="canonical">`** | **Low** | Low | client + server |
| F8 | `robots.txt` has **no `Sitemap:` line** | **Low** | Trivial | `public/robots.txt` |
| F9 | **CWV/perf** unverified: single JS+CSS bundle, render-blocking external font CSS | **Secondary** | Med | build, `index.html` |

### F1 — No per-URL social previews *(High)*
**Evidence:** `/` and `/events` return identical OG tags; `og:title` is hardcoded "Nested NYC — a student-only project network" for every URL.
**Why it matters:** Unfurlers never run JS, so a student sharing `nested.social/projects/<id>` in a group chat or on LinkedIn gets a generic, image-less card instead of the project's title/blurb/flyer. This directly suppresses click-through and viral sharing — the network's primary growth loop.
**Recommendation:** Server-inject per-entity `og:title`, `og:description`, `og:image`, `twitter:*` for `/projects/:id`, `/events/:id`, `/org/:slug` (see "Recommended architecture"). **Only a server-side fix addresses this** — client JS cannot.

### F2 — Conditional indexability + static-only meta *(High)*
**Evidence:** Served head carries the generic `<meta name="description">` on every route; only `document.title` is updated client-side (`NestedApp.jsx:263`). Empty `<div id="root">` confirmed in prod.
**Why it matters:** Google *can* index CSR content but on a lagging, error-prone second pass; non-Google crawlers largely can't. Per-route descriptions are what populate SERP snippets.
**Recommendation:** Two layers — (a) cheap: extend the existing URL-mirror effect to also set `<meta name="description">`/canonical/OG client-side (helps Googlebot); (b) durable: server-inject the same (helps everyone). Do both; (a) is a ~1-function change next to the existing `document.title` write.

### F3 — No valid sitemap (and the path is masked) *(High)*
**Evidence:** `https://nested.social/sitemap.xml` → `200` `text/html`, 1783 bytes (the SPA shell).
**Why it matters:** With no in-HTML link graph (state-driven nav) and no sitemap, Google has no reliable way to discover `/projects/:id`, `/events/:id`, `/org/:slug`. Submitting the current `/sitemap.xml` to Search Console would register an **invalid** sitemap (HTML, not XML).
**Recommendation:** Generate a sitemap of **public, published** entities only. Because the rewrite masks non-files, implement as either: a real file emitted at build time into `public/sitemap.xml`, **or** an `/api/sitemap` function with a `vercel.json` rewrite `/sitemap.xml → /api/sitemap`. Prefer the function (stays fresh as projects/events are created). Add the `Sitemap:` line to `robots.txt` (F8).

### F4 — No image in previews *(Med)*
**Evidence:** No `og:image`/`twitter:image` in served head; `twitter:card=summary`.
**Recommendation:** Floor: add one branded 1200×630 `public/og-default.png`, reference it in `index.html`, and switch `twitter:card` to `summary_large_image`. Ceiling: per-entity dynamic OG images via `@vercel/og` (e.g. `/api/og?type=project&id=…` rendering the flyer/title) — high shareability payoff, pairs with F1.

### F5 — No structured data *(Med-High)*
**Why it matters:** `Event` JSON-LD makes campus events eligible for Google's rich results and Events experiences — a strong, on-brand organic surface for a campus-events product. `Organization`/`CollegeOrUniversity` helps org pages; `WebSite` helps the brand.
**Recommendation:** Inject JSON-LD `Event` on `/events/:id` (name, `startDate`, `location`, `organizer`, `eventAttendanceMode`, free `offers`), `Organization` on `/org/:slug`, `WebSite`+`Organization` on home. Server-injected is most reliable; client-injected works for Google since it renders JS. **Note:** `<script type="application/ld+json">` is data, not executed JS, so the current CSP (`script-src 'self' …`) does **not** block it — no CSP change needed.

### F6 — Soft-404s *(Med)*
**Evidence:** The SPA rewrite returns `200`+shell for any path, including non-existent project/event IDs.
**Why it matters:** Google may index "not found" pages and dilute crawl signals.
**Recommendation:** The prerender function should return a real `404` for missing/unpublished entities; the SPA's empty-state could also set a `noindex` meta client-side as a backstop.

### F7 — No canonical *(Low)*
**Recommendation:** Emit `<link rel="canonical">` per route (client + server). Cheap insurance against query-param/case/duplicate dilution. Also ensure one canonical host (apex vs `www`) via a redirect.

### F8 — robots.txt has no Sitemap line *(Trivial)*
**Recommendation:** After F3, append `Sitemap: https://nested.social/sitemap.xml`. Keep it otherwise permissive (matches the intended posture). Optionally `Disallow:` low-value auth routes (`/login`, `/signup`, `/create`, `/dashboard`) to focus crawl budget — optional; crawl budget is a non-issue at this scale.

### F9 — Core Web Vitals (secondary, unmeasured) *(Secondary)*
**Note:** Not measured here — no Lighthouse/PSI run. Two things visible from the served HTML worth checking first: a **single un-split JS bundle** (`/assets/index-*.js`; the shell is ~1.7 KB but the app is one ~1,700-line component) which can hurt LCP/TBT, and a **render-blocking external Google Fonts stylesheet** (already `display=swap` + preconnect, which is good). **Recommendation:** Run PageSpeed Insights on home + a project page; consider route-level code-splitting and self-hosting fonts only if the numbers justify it. CWV is a real but lower-tier ranking factor — fix content/indexability (F1–F5) first.

---

## Recommended architecture — serverless meta/prerender layer

This is the keystone fix; it resolves F1, F2, F5, F6 at once and is idiomatic for this repo (which already runs Supabase-backed serverless functions — see `api/notify.js`).

**Shape:** A Vercel serverless function handles the **public entity routes** (`/projects/:id`, `/events/:id`, `/org/:slug`, and optionally `/` + `/events`). It:
1. Fetches the entity from Supabase,
2. Reads `index.html`,
3. Replaces the `<head>` meta block with **per-entity** `<title>`, description, OG, Twitter, `og:image`, canonical, and JSON-LD,
4. Returns the enriched HTML (the SPA still boots from the same `#root`).

**Serve enriched HTML to everyone, not just bots.** UA-sniffing to serve bots different content is cloaking-adjacent and risky; since we only enrich `<head>` (the `#root`/SPA is unchanged), there's no downside to serving the enriched page to humans too. Avoid UA cloaking.

**⚠️ Critical safety caveat — use the anon key, not the service role.** `api/notify.js` uses the **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`) because it's trusted email infrastructure. The prerender function must instead use the **anon key**, so Supabase **RLS** enforces exactly the public visibility the app already grants (published projects, verified orgs/events). Using service-role here would risk leaking **unpublished/private rows** into public, cacheable HTML. This is the easiest thing to get wrong and the most damaging.

**Wiring & ops:**
- `vercel.json`: add rewrites for the entity paths → the function, keeping the `/api/` and static-asset bypass intact. Mind the existing catch-all rewrite ordering (and the masking behavior proven in F3).
- **Caching:** `Cache-Control: s-maxage=…, stale-while-revalidate=…` so prerenders are cheap and resilient; invalidation is time-based.
- **404s:** return real `404` for missing/unpublished entities (F6).
- **CSP:** no change needed for JSON-LD; same-origin `/api/og` images and existing `https://*.supabase.co` `img-src` already covered. (CSP is report-only anyway.)

**Alternative considered — full SSR (e.g. migrate to Next.js):** rejected as disproportionate. The app is a deliberate state-machine SPA with auth-gated everything; a full SSR rewrite is large and high-risk for a payoff the serverless layer already delivers on the routes that matter.

---

## Privacy — what must stay non-indexed (already correct)

The SEO targets are exactly the **public** access class in `router.js` `ROUTES`: `discover` (`/`), `events` (`/events`), `eventDetail` (`/events/:id`), `detail` (`/projects/:id`), `orgView` (`/org/:slug`).

Everything else is `student`/`org`/`anon`-gated — student profiles (`/u/:username`), `/people`, `/saved`, `/create`, `/dashboard/*`, auth screens. Anonymous crawlers hit the auth wall, so these **can't and shouldn't** be indexed. Two guardrails to preserve when implementing the above:
- The prerender layer must cover **only** public routes, and must use the **anon key** so RLS keeps gated data out of prerendered HTML.
- Don't add gated routes to the sitemap.

---

## Recommended phasing

**Phase 0 — Static quick wins (hours, no new infra; helps Google, not unfurlers):**
- `public/og-default.png` + reference in `index.html`; switch `twitter:card` → `summary_large_image` (F4 floor).
- Client-side per-route `<meta description>` + `canonical` + OG, mirroring the existing `document.title` write in `NestedApp.jsx:263` (F2a, F7).
- Client-injected `Event`/`Organization` JSON-LD (F5, partial — Google only).
- After Phase 1's sitemap exists, add `Sitemap:` to `robots.txt` (F8).

**Phase 1 — Dynamic previews + discovery (the high-ROI core):**
- Serverless meta/prerender layer for public entity routes, **anon key**, served to all, with real 404s (F1, F2b, F6).
- `sitemap.xml` via `/api/sitemap` (published entities only) + rewrite (F3); then F8.

**Phase 2 — Delight & richness:**
- Per-entity dynamic OG images via `@vercel/og` (`/api/og?...`) wired into the prerender layer (F4 ceiling).
- Server-injected JSON-LD replacing the client fallback (F5, robust).

**Phase 3 — Performance (measure first):**
- Run PSI; if warranted, route-level code-splitting and/or self-hosted fonts (F9).

---

## How to verify after each phase
- **Social:** Facebook Sharing Debugger, Twitter/X Card Validator, LinkedIn Post Inspector, Slack/Discord paste tests on a real project + event URL.
- **Structured data:** Google Rich Results Test + Schema.org validator on an event URL.
- **Indexing:** submit the new `sitemap.xml` in Google Search Console; watch Coverage; use URL Inspection's "rendered HTML."
- **Raw bytes:** re-run the `Invoke-WebRequest` head check used in this audit — `/`, `/events`, and a project/event URL should now differ.
- **Perf:** PageSpeed Insights on home + a project page.

---

## Files that *would* change (none changed yet)
- `index.html` — `og:image`, `twitter:card`, (optional) base JSON-LD.
- `src/design/NestedApp.jsx` — extend the URL-mirror effect to set `<meta>`/canonical/OG/JSON-LD client-side.
- `public/robots.txt` — `Sitemap:` line.
- `public/og-default.png` — new branded image asset.
- `vercel.json` — rewrites for the prerender function + `/sitemap.xml`.
- `api/prerender.js` (new) — meta/prerender injector (**anon key**).
- `api/sitemap.js` (new) — dynamic sitemap.
- `api/og.js` (new, Phase 2) — dynamic OG images (`@vercel/og`).
