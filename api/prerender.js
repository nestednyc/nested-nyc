/* ============================================================
   NESTED NYC — per-entity <head> prerender (bots + humans)
   ------------------------------------------------------------
   The SPA serves one static shell for every URL, so crawlers and
   link-unfurlers (Twitter/X, LinkedIn, Slack, iMessage, Discord,
   WhatsApp — none run JS) see the same generic title/OG card on
   every project, event, and org page. vercel.json rewrites those
   three public routes here; this function fetches the entity and
   injects real <title>, description, Open Graph, canonical, and
   JSON-LD into the SHELL, then returns it. The #root div is
   untouched, so the SPA still boots and takes over for humans.

   Served to everyone (no user-agent cloaking): we only enrich the
   <head>. We MUST start from the freshly built dist/index.html —
   its hashed /assets/* URLs change every build, so an inlined
   template would boot a stale/blank SPA. It is bundled in via
   vercel.json → functions["api/prerender.js"].includeFiles.

   Reads with the ANON key so Supabase RLS returns exactly the
   public rows the app exposes (published projects, verified
   orgs/events). NEVER the service-role key here — that bypasses
   RLS and would bake private rows into public, cacheable HTML.
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

const SITE = "https://nested.social";
const SITE_NAME = "Nested NYC";
const DEFAULT_OG_IMAGE = SITE + "/og-default.png";
const SITE_DESC =
  "Nested is a student-only project network for NYC universities. Discover projects, find teammates, and see what's happening on campus.";

// /org/* paths that are SPA auth routes, not org slugs — the rewrite catches
// them too, so map them back to the clean shell instead of a 404.
const RESERVED_ORG = new Set(["signup", "onboarding"]);

const supa =
  SUPABASE_URL && ANON_KEY
    ? createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// Read the built shell once per cold start. Try a few locations so it resolves
// regardless of how Vercel lays out the included file at runtime.
let SHELL = null;
function shell() {
  if (SHELL !== null) return SHELL;
  const candidates = [path.join(process.cwd(), "dist", "index.html")];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(here, "..", "dist", "index.html"));
    candidates.push(path.join(here, "dist", "index.html"));
  } catch (e) {}
  for (const p of candidates) {
    try { SHELL = fs.readFileSync(p, "utf-8"); return SHELL; } catch (e) {}
  }
  SHELL = "";
  return SHELL;
}

function first(v) { return Array.isArray(v) ? v[0] : v; }

// Escape for HTML text + double-quoted attribute values.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Collapse whitespace and clip to a sane meta length.
function clip(s, n) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

// Only trust an entity image if it's already an absolute URL; storage paths
// without a host fall back to the branded default.
function absImage(u) {
  return u && /^https?:\/\//i.test(u) ? u : DEFAULT_OG_IMAGE;
}

function eventJsonLd(e, org) {
  const j = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title || "Event",
    url: SITE + "/events/" + e.id,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  };
  if (e.description) j.description = clip(e.description, 300);
  // events.date is stored ISO-ish (YYYY-MM-DD). Only emit startDate when it
  // parses — an invalid startDate disqualifies the Event rich result entirely.
  if (e.date && /^\d{4}-\d{2}-\d{2}/.test(e.date)) j.startDate = e.date;
  if (e.location || e.address) {
    j.location = { "@type": "Place", name: e.location || e.address };
    if (e.address) j.location.address = e.address;
  }
  if (org && org.name) {
    j.organizer = { "@type": "Organization", name: org.name };
    if (org.slug) j.organizer.url = SITE + "/org/" + org.slug;
  }
  if (absImage(e.image) !== DEFAULT_OG_IMAGE) j.image = absImage(e.image);
  return j;
}

// Fetch one public entity and shape the head values. Returns null when the row
// isn't anon-visible (RLS → no rows) — caller treats that as not-found.
async function load(type, key) {
  if (!supa || !key) return null;

  if (type === "project") {
    const { data } = await supa
      .from("projects")
      .select("id, name, tagline, description, category, image, university")
      .eq("id", key)
      .single();
    if (!data) return null;
    const name = data.name || "Project";
    const desc = clip(data.tagline || data.description || "", 200) || SITE_DESC;
    return {
      name,
      title: name + " · " + SITE_NAME,
      desc,
      url: SITE + "/projects/" + data.id,
      image: absImage(data.image),
      jsonld: {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name,
        url: SITE + "/projects/" + data.id,
        ...(data.tagline || data.description ? { description: clip(data.tagline || data.description, 300) } : {}),
      },
    };
  }

  if (type === "event") {
    const { data } = await supa
      .from("events")
      .select("id, title, description, date, time, location, address, image, organization:organizations(name, slug)")
      .eq("id", key)
      .single();
    if (!data) return null;
    const org = data.organization || null;
    const name = data.title || "Event";
    const desc = clip(data.description || "", 200) || ("An event on " + SITE_NAME + ".");
    return {
      name,
      title: name + " · " + SITE_NAME,
      desc,
      url: SITE + "/events/" + data.id,
      image: absImage(data.image),
      jsonld: eventJsonLd(data, org),
    };
  }

  if (type === "org") {
    const { data } = await supa
      .from("organizations")
      .select("slug, name, bio, logo, banner")
      .eq("slug", key)
      .single();
    if (!data) return null;
    const name = data.name || "Organization";
    const desc = clip(data.bio || "", 200) || ("An organization on " + SITE_NAME + ".");
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      url: SITE + "/org/" + data.slug,
    };
    if (data.bio) jsonld.description = clip(data.bio, 300);
    if (absImage(data.logo) !== DEFAULT_OG_IMAGE) jsonld.logo = absImage(data.logo);
    return {
      name,
      title: name + " · " + SITE_NAME,
      desc,
      url: SITE + "/org/" + data.slug,
      image: absImage(data.banner || data.logo),
      jsonld,
    };
  }

  return null;
}

// --- HTML patching (function-form replacements so a `$` in entity text can't
// be read as a replacement-pattern token) -------------------------------------
function setProp(html, prop, value) {
  const re = new RegExp('(<meta property="' + prop + '" content=")[^"]*(")');
  return html.replace(re, (m, p1, p2) => p1 + value + p2);
}
function setName(html, name, value) {
  const re = new RegExp('(<meta name="' + name + '" content=")[^"]*(")');
  return html.replace(re, (m, p1, p2) => p1 + value + p2);
}
// JSON-LD escape: only `<` matters (prevents a `</script>` breakout).
function ld(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function inject(html, m) {
  let h = html;
  h = h.replace(/<title>[^<]*<\/title>/, () => "<title>" + esc(m.title) + "</title>");
  h = setName(h, "description", esc(m.desc));
  h = setProp(h, "og:title", esc(m.title));
  h = setProp(h, "og:description", esc(m.desc));
  h = setProp(h, "og:url", esc(m.url));
  h = setProp(h, "og:image", esc(m.image));
  h = setProp(h, "og:image:alt", esc(m.name));
  h = setName(h, "twitter:title", esc(m.title));
  h = setName(h, "twitter:description", esc(m.desc));
  h = setName(h, "twitter:image", esc(m.image));
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, (mm, p1, p2) => p1 + esc(m.url) + p2);
  // Entity images aren't 1200×630 — drop the static dimension hints from the shell.
  if (m.image !== DEFAULT_OG_IMAGE) {
    h = h.replace(/\s*<meta property="og:image:width"[^>]*>/, "");
    h = h.replace(/\s*<meta property="og:image:height"[^>]*>/, "");
  }
  // Entity JSON-LD, alongside the brand graph already in the shell.
  h = h.replace("</head>", () => '    <script type="application/ld+json">' + ld(m.jsonld) + "</script>\n  </head>");
  return h;
}

function injectNoindex(html) {
  return html.replace("</head>", '    <meta name="robots" content="noindex">\n  </head>');
}

export default async function handler(req, res) {
  const q = req.query || {};
  const type = first(q.type);
  const key = first(q.id) || first(q.slug);

  const html = shell();
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // No shell on disk, or DB not configured → fail open: serve what we have so
  // the SPA still boots. Never 404 a real route over a config problem.
  if (!html) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send("<!doctype html><html><head><meta charset=\"utf-8\"></head><body><div id=\"root\"></div></body></html>");
  }
  if (!supa) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(200).send(html);
  }

  // Reserved /org/* SPA routes (signup/onboarding): clean shell, valid page.
  if (type === "org" && RESERVED_ORG.has(String(key || "").toLowerCase())) {
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(html);
  }

  let meta = null;
  try { meta = await load(type, key); } catch (e) { meta = null; }

  // Not a public entity (missing / unpublished / unverified). 404 + noindex so
  // soft-404s don't get indexed; the body is still the shell, so the browser
  // boots the SPA and shows its empty state.
  if (!meta) {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(404).send(injectNoindex(html));
  }

  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return res.status(200).send(inject(html, meta));
}
