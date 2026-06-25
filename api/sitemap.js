/* ============================================================
   NESTED NYC — dynamic sitemap.xml
   ------------------------------------------------------------
   vercel.json rewrites /sitemap.xml here (a static file would be
   swallowed by the SPA fallback rewrite). Lists the public,
   indexable URLs so crawlers can discover them — there is no
   static <a href> link graph (navigation is state-driven).

   Reads with the ANON key, so RLS yields exactly the rows the
   app exposes anonymously: published projects, verified orgs,
   and anon-visible events. Gated routes are never emitted.
   ============================================================ */
import { createClient } from "@supabase/supabase-js";
import { limit, clientIp } from "./_rate-limit.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SITE = "https://nested.social";

const supa =
  SUPABASE_URL && ANON_KEY
    ? createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function xml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// timestamptz → YYYY-MM-DD (W3C date, valid <lastmod>).
function day(v) {
  const m = String(v == null ? "" : v).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function url(loc, lastmod) {
  return "  <url><loc>" + xml(loc) + "</loc>" + (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") + "</url>";
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");

  const urls = [url(SITE + "/"), url(SITE + "/events")];

  // Per-IP cap on cache-miss invocations; over the limit, emit just the static
  // URLs (skip the three 5k-row queries) rather than 429-ing a crawler.
  const allowed = await limit(`sitemap:${clientIp(req)}`, 60, 60);

  if (supa && allowed) {
    const [projects, events, orgs] = await Promise.all([
      supa.from("projects").select("id, updated_at, created_at").eq("publish_to_discover", true).order("updated_at", { ascending: false }).limit(5000),
      supa.from("events").select("id, created_at").order("created_at", { ascending: false }).limit(5000),
      supa.from("organizations").select("slug, created_at").eq("verified", true).order("created_at", { ascending: false }).limit(5000),
    ]);
    for (const p of projects.data || []) urls.push(url(SITE + "/projects/" + p.id, day(p.updated_at || p.created_at)));
    for (const e of events.data || []) urls.push(url(SITE + "/events/" + e.id, day(e.created_at)));
    for (const o of orgs.data || []) if (o.slug) urls.push(url(SITE + "/org/" + o.slug, day(o.created_at)));
  }

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n";

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(body);
}
