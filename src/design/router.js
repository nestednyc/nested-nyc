/* ============================================================
   NESTED NYC — URL codec (a mirror, not a router)
   ============================================================
   NestedApp's string `route` state stays the single source of
   truth; this module is the pure codec between that state and the
   address bar. NestedApp integrates it at exactly three points:
   a one-time boot parse, a write-only sync effect (pushState /
   replaceState), and a popstate listener. No React, no deps.

   parse(pathname, search) → {route, params, state}
                           | {authCallback, kind, next}   (/auth/*)
                           | null                         (unknown path)
   build(route, snap)      → path string | null (null = leave URL alone)
   accessOf(route)         → "public" | "student" | "org" | "anon"
   validateNext(raw)       → safe internal path | null
   titleFor(route, ctx)    → document.title string
   ============================================================ */

// Order matters: literal segments beat params (/org/signup before
// /org/:slug), first match wins. `params` maps URL param → the
// NestedApp state field it hydrates. `state` is extra state pinned
// by the path itself (e.g. which auth form /login opens).
//
// `soon` has no entry on purpose: no URL at all (build returns null, the
// URL stays put). Org owners have no public-page route — visiting their
// own /org/:slug just routes them to the dashboard.
const ROUTES = [
  { route: "discover",      path: "/",                          access: "public" },
  { route: "events",        path: "/events",                    access: "public" },
  { route: "eventDetail",   path: "/events/:id",                access: "public",  params: { id: "eventViewId" } },
  { route: "detail",        path: "/projects/:id",              access: "public",  params: { id: "detailId" } },
  { route: "edit",          path: "/projects/:id/edit",         access: "student", params: { id: "editId" } },
  { route: "create",        path: "/create",                    access: "student" },
  { route: "people",        path: "/people",                    access: "student" },
  { route: "saved",         path: "/saved",                     access: "student" },
  { route: "notifications", path: "/notifications",             access: "student" },
  { route: "messages",      path: "/messages",                  access: "student" },
  { route: "messageThread", path: "/messages/:username",         access: "student", params: { username: "messageThreadHandle" } },
  { route: "profile",       path: "/profile",                   access: "student" },
  { route: "userProfile",   path: "/u/:username",               access: "student", params: { username: "profileViewUsername" } },
  { route: "onboarding",    path: "/login",                     access: "anon",    state: { authMode: "signin" } },
  { route: "onboarding",    path: "/signup",                    access: "anon",    state: { authMode: "signup" } },
  { route: "forgot",        path: "/forgot",                    access: "anon" },
  { route: "orgSignup",     path: "/org/signup",                access: "anon" },
  { route: "orgOnboarding", path: "/org/onboarding",            access: "anon" },
  { route: "orgView",       path: "/org/:slug",                 access: "public",  params: { slug: "orgViewSlug" } },
  { route: "orgDashboard",  path: "/dashboard",                 access: "org" },
  { route: "orgEditMe",     path: "/dashboard/edit",            access: "org" },
  { route: "eventCreate",   path: "/dashboard/events/new",      access: "org" },
  { route: "eventEdit",     path: "/dashboard/events/:id/edit", access: "org",     params: { id: "eventDraftId" } },
];
for (const r of ROUTES) r.segs = r.path === "/" ? [] : r.path.slice(1).split("/");

const ACCESS = {
  soon: "public",
};
for (const r of ROUTES) if (!(r.route in ACCESS)) ACCESS[r.route] = r.access;

export function accessOf(route) {
  return ACCESS[route] || "public";
}

export function parse(pathname, search) {
  let path = pathname || "/";
  if (path.length > 1 && path.charCodeAt(path.length - 1) === 47 /* '/' */) {
    path = path.replace(/\/+$/, "") || "/";
  }

  // /auth/* belongs to the Supabase email links (confirm / recovery) —
  // supabase-js consumes the #access_token hash itself; we only read which
  // flavor it was and the (validated) ?next= return path. Never routed.
  if (path === "/auth" || path.indexOf("/auth/") === 0) {
    let rawNext = null;
    try { rawNext = new URLSearchParams(search || "").get("next"); } catch (e) {}
    return {
      authCallback: true,
      kind: path === "/auth/reset" || path.indexOf("/auth/reset/") === 0 ? "reset" : "confirm",
      next: validateNext(rawNext),
    };
  }

  const segs = path === "/" ? [] : path.slice(1).split("/");
  outer: for (const r of ROUTES) {
    if (r.segs.length !== segs.length) continue;
    const params = {};
    for (let i = 0; i < r.segs.length; i++) {
      const pat = r.segs[i];
      if (pat.charCodeAt(0) === 58 /* ':' */) {
        let v = segs[i];
        try { v = decodeURIComponent(v); } catch (e) { continue outer; }
        if (!v) continue outer;
        params[r.params[pat.slice(1)]] = v;
      } else if (pat !== segs[i].toLowerCase()) {
        // Literal segments match case-insensitively (typed URLs); the sync
        // effect then rewrites the bar to the canonical lowercase path.
        continue outer;
      }
    }
    return { route: r.route, params, state: r.state ? { ...r.state } : {} };
  }
  return null;
}

const enc = encodeURIComponent;
// route → path, from a snapshot of the param state the route owns. null means
// "leave the URL alone": soon has no URL, and a param route with a null param
// would write a broken path — staying put is always safer than a wrong pushState.
const BUILD = {
  discover:      () => "/",
  events:        () => "/events",
  eventDetail:   (s) => (s.eventViewId ? "/events/" + enc(s.eventViewId) : null),
  detail:        (s) => (s.detailId ? "/projects/" + enc(s.detailId) : null),
  edit:          (s) => (s.editId ? "/projects/" + enc(s.editId) + "/edit" : null),
  create:        () => "/create",
  people:        () => "/people",
  saved:         () => "/saved",
  notifications: () => "/notifications",
  messages:      () => "/messages",
  messageThread: (s) => (s.messageThreadHandle ? "/messages/" + enc(s.messageThreadHandle) : null),
  profile:       () => "/profile",
  userProfile:   (s) => (s.profileViewUsername ? "/u/" + enc(s.profileViewUsername) : null),
  orgView:       (s) => (s.orgViewSlug ? "/org/" + enc(s.orgViewSlug) : null),
  onboarding:    (s) => (s.authMode === "signin" ? "/login" : "/signup"),
  forgot:        () => "/forgot",
  orgSignup:     () => "/org/signup",
  orgOnboarding: () => "/org/onboarding",
  orgDashboard:  () => "/dashboard",
  orgEditMe:     () => "/dashboard/edit",
  eventCreate:   () => "/dashboard/events/new",
  eventEdit:     (s) => (s.eventDraftId ? "/dashboard/events/" + enc(s.eventDraftId) + "/edit" : null),
  soon:          () => null,
};

export function build(route, snap) {
  const fn = BUILD[route];
  return fn ? fn(snap || {}) : null;
}

// Validate a ?next= return path from an auth email link. Only paths we could
// have written ourselves survive: internal (leading single slash, no
// backslash tricks), not /auth/* (no callback loops), and parseable to a
// known route. Everything else — //evil.com, https://…, garbage — dies here,
// so a crafted signup link can never bounce a fresh session off-site.
export function validateNext(raw) {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  if (raw.charCodeAt(0) !== 47 /* '/' */) return null;
  if (raw.charCodeAt(1) === 47 || raw.indexOf("\\") !== -1) return null;
  const pathname = raw.split(/[?#]/)[0];
  const parsed = parse(pathname, "");
  if (!parsed || parsed.authCallback) return null;
  return pathname;
}

const SITE = "Nested NYC";
export function titleFor(route, ctx) {
  const c = ctx || {};
  switch (route) {
    case "discover":      return SITE;
    case "events":        return "Events · " + SITE;
    case "eventDetail":   return "Event · " + SITE;
    case "detail":        return c.detailTitle ? c.detailTitle + " · " + SITE : SITE;
    case "edit":          return "Edit flyer · " + SITE;
    case "create":        return "Pin a project · " + SITE;
    case "people":        return "People · " + SITE;
    case "saved":         return "Saved · " + SITE;
    case "notifications": return "Notifications · " + SITE;
    case "messages":      return "Messages · " + SITE;
    case "messageThread": return c.threadName ? "@" + c.threadName + " · " + SITE : "Messages · " + SITE;
    case "profile":       return "Your profile · " + SITE;
    case "userProfile":   return c.username ? "@" + c.username + " · " + SITE : SITE;
    case "orgView":       return c.orgSlug ? c.orgSlug + " · " + SITE : SITE;
    case "onboarding":    return (c.authMode === "signin" ? "Log in" : "Sign up") + " · " + SITE;
    case "forgot":        return "Reset password · " + SITE;
    case "orgSignup":     return "Orgs on Nested · " + SITE;
    case "orgOnboarding": return "Set up your org · " + SITE;
    case "orgDashboard":  return "Dashboard · " + SITE;
    case "orgEditMe":     return "Edit org page · " + SITE;
    case "eventCreate":   return "Pin an event · " + SITE;
    case "eventEdit":     return "Edit event · " + SITE;
    default:              return SITE;
  }
}

// Per-route meta description — the companion to titleFor, fed the SAME ctx by
// the URL-mirror effect. Only the project `detail` route carries entity data
// synchronously (the project blurb); eventDetail / orgView self-fetch in their
// own components, so client-side they fall back to the site description — the
// server prerender (api/prerender.js) supplies their real per-entity meta for
// crawlers and social unfurlers.
const SITE_DESC =
  "Nested is a student-only project network for NYC universities. Discover projects, find teammates, and see what's happening on campus.";
export function describeFor(route, ctx) {
  const c = ctx || {};
  switch (route) {
    case "discover":    return SITE_DESC;
    case "events":      return "Browse upcoming events across NYC campuses — talks, hackathons, mixers, and workshops — on Nested.";
    case "detail":      return c.detailBlurb || (c.detailTitle ? c.detailTitle + " — a student project on Nested." : SITE_DESC);
    case "userProfile": return c.username ? "@" + c.username + " on Nested — the student-only project network for NYC universities." : SITE_DESC;
    default:            return SITE_DESC;
  }
}
