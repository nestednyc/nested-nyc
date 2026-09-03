/* ============================================================
   NESTED NYC — weekly digest ("This week on the board")
   ------------------------------------------------------------
   Vercel Cron hits GET /api/digest every Monday 14:00 UTC (10am ET,
   see vercel.json). For every student who hasn't opted out it sends
   one email: the week's best notes (their school first), the events
   coming up, and the new flyers — via Resend's batch endpoint.

   Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>`; a manual
   run may send `x-webhook-secret: <WEBHOOK_SECRET>` instead.
   Safety: `digest_log` (user × ISO week) makes a re-run idempotent;
   a quiet week (nothing to say) sends nothing; `?dry=1` returns the
   plan + one rendered sample and sends nothing.
   ============================================================ */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { emails } from "./_email/template.js";
import { UNI, personLabel, resolveOrgUniSlug } from "../src/design/data.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_VERCEL_KEY || process.env.RESEND_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;
const EMAIL_FROM = process.env.EMAIL_FROM || "Nested <hi@nested.social>";
const APP_URL = process.env.APP_URL || "https://www.nested.social";
const UNSUB_SECRET = process.env.UNSUBSCRIBE_SECRET || WEBHOOK_SECRET || "";
const HIDE_AT = 3;          // mirrors communityService.HIDE_AT
const BATCH = 50;           // Resend batch max is 100; keep headroom

const admin =
  SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

function header(req, key) {
  const v = req.headers[key];
  return Array.isArray(v) ? v[0] : v;
}
function secretsMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function hmac(s) {
  return crypto.createHmac("sha256", UNSUB_SECRET).update(s).digest("hex");
}
function unsubUrl(userId) {
  return `${APP_URL}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${hmac(String(userId))}`;
}
function digestUnsubUrl(userId) {
  return `${APP_URL}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${hmac(`${userId}:digest`)}&kind=digest`;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
// Monday of the current ISO week (UTC) — the idempotency key.
function weekStartOf(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Mon=0
  x.setUTCDate(x.getUTCDate() - day);
  return isoDate(x);
}
function uniLabel(id) {
  return (id && UNI[id] && UNI[id].name) || "";
}
function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
const KIND_WORD = { win: "win", ask: "looking for", update: "update" };
function postScore(p) {
  return (p.like_count || 0) * 2 + (p.comment_count || 0) * 3 + (p.kind === "win" ? 2 : p.kind === "ask" ? 1 : 0);
}

async function sendBatch(items) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend batch ${res.status}: ${body.slice(0, 300)}`);
  }
}

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = header(req, "authorization") || "";
  const cronOk = !!CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
  const manualOk = secretsMatch(header(req, "x-webhook-secret"), WEBHOOK_SECRET);
  if (!cronOk && !manualOk) return res.status(401).json({ error: "Unauthorized" });
  if (!admin) return res.status(500).json({ error: "Server not configured" });

  const q = req.query || {};
  const dry = String(Array.isArray(q.dry) ? q.dry[0] : q.dry || "") === "1";
  if (!dry && !RESEND_API_KEY) return res.status(500).json({ error: "RESEND key missing" });

  const now = new Date();
  const weekStart = weekStartOf(now);
  const since = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
  const today = isoDate(now);
  const plus7 = isoDate(new Date(now.getTime() + 7 * 86400 * 1000));

  try {
    // ── the week's content ──
    const [postsRes, eventsRes, flyersRes, unisRes] = await Promise.all([
      admin
        .from("posts")
        .select("id, body, kind, author_name, author_handle, org_id, university, like_count, comment_count, created_at, org:organizations(name)")
        .gte("created_at", since)
        .lt("report_count", HIDE_AT)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("events")
        .select("id, title, date, time, location, organization:organizations(name, verified, student_run, type, slug, university_id)")
        .gte("date", today)
        .lte("date", plus7)
        .order("date", { ascending: true })
        .limit(50),
      admin
        .from("projects")
        .select("id, name, tagline, university, created_at")
        .eq("publish_to_discover", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
      admin.from("organizations").select("id, slug").eq("type", "university"),
    ]);
    // Fail closed: a broken content query must be a retryable 500, never a
    // "quiet week" that logs nothing and emails nobody.
    for (const r of [postsRes, eventsRes, flyersRes, unisRes]) if (r.error) throw r.error;
    const posts = postsRes.data || [];
    const events = eventsRes.data || [];
    const flyers = flyersRes.data || [];
    const unis = unisRes.data || [];
    // Live hosts only: verified orgs and student-run clubs (live without a tick).
    const okEvents = (events || []).filter((e) => !e.organization || e.organization.verified || e.organization.student_run);
    if (!(posts || []).length && !okEvents.length && !(flyers || []).length) {
      return res.status(200).json({ skipped: "quiet week", weekStart });
    }

    // ── recipients (paged past PostgREST's 1,000-row cap) ──
    async function allRows(build) {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await build().range(from, from + 999);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return out;
    }
    const users = await allRows(() =>
      admin
        .from("profiles")
        .select("id, first_name, username, university")
        .eq("account_type", "student")
        .eq("onboarding_completed", true)
        .eq("email_opt_out", false)
        .eq("digest_opt_out", false)
        .order("id")
    );
    const sentRows = await allRows(() => admin.from("digest_log").select("user_id").eq("week_start", weekStart).order("user_id"));
    const already = new Set(sentRows.map((r) => r.user_id));
    const targets = users.filter((u) => !already.has(u.id));

    // ── per-school picks (computed once per campus, reused per user) ──
    const scored = (posts || []).map((p) => ({ ...p, score: postScore(p) }));
    const eventUni = (e) =>
      e.organization
        ? resolveOrgUniSlug({ type: e.organization.type || "club", slug: e.organization.slug, university_id: e.organization.university_id }, unis || [])
        : null;
    const cache = new Map();
    function picksFor(uni) {
      if (cache.has(uni)) return cache.get(uni);
      const mine = scored.filter((p) => uni && p.university === uni).sort((a, b) => b.score - a.score);
      const rest = scored.filter((p) => !(uni && p.university === uni)).sort((a, b) => b.score - a.score);
      const postItems = [...mine, ...rest].slice(0, 5).map((p) => ({
        label: `${p.org_id ? (p.org && p.org.name) || p.author_name : personLabel({ username: p.author_handle, first_name: p.author_name }, "A student")} · ${KIND_WORD[p.kind] || "update"}`,
        sub: clip(p.body || "(photo)", 140),
        url: `${APP_URL}/community/${p.id}`,
      }));
      const evMine = okEvents.filter((e) => uni && eventUni(e) === uni);
      const evRest = okEvents.filter((e) => !(uni && eventUni(e) === uni));
      const eventItems = [...evMine, ...evRest].slice(0, 5).map((e) => ({
        label: e.title,
        sub: [e.date, e.time, e.organization && e.organization.name, e.location].filter(Boolean).join(" · "),
        url: `${APP_URL}/events/${e.id}`,
      }));
      const flMine = (flyers || []).filter((f) => uni && f.university === uni);
      const flRest = (flyers || []).filter((f) => !(uni && f.university === uni));
      const flyerItems = [...flMine, ...flRest].slice(0, 5).map((f) => ({
        label: f.name,
        sub: clip(f.tagline || "", 100),
        url: `${APP_URL}/projects/${f.id}`,
      }));
      const out = { postItems, eventItems, flyerItems };
      cache.set(uni, out);
      return out;
    }

    // ── addresses (auth.users) ──
    const withEmail = [];
    for (let i = 0; i < targets.length; i += 10) {
      const chunk = targets.slice(i, i + 10);
      const got = await Promise.all(chunk.map((u) => admin.auth.admin.getUserById(u.id).then(({ data }) => data?.user?.email || null).catch(() => null)));
      chunk.forEach((u, j) => { if (got[j]) withEmail.push({ ...u, email: got[j] }); });
    }

    // ── render ──
    const messages = withEmail.map((u) => {
      const { postItems, eventItems, flyerItems } = picksFor(u.university);
      const mail = emails.weeklyDigest({
        firstName: (u.first_name || "").trim(),
        school: uniLabel(u.university),
        posts: postItems,
        events: eventItems,
        flyers: flyerItems,
        unsubUrl: unsubUrl(u.id),
        digestUnsubUrl: digestUnsubUrl(u.id),
      });
      return {
        userId: u.id,
        payload: {
          from: EMAIL_FROM,
          to: u.email,
          subject: mail.subject,
          html: mail.html,
          headers: {
            "List-Unsubscribe": `<${digestUnsubUrl(u.id)}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        },
      };
    });

    if (dry) {
      return res.status(200).json({
        dry: true,
        weekStart,
        content: { posts: (posts || []).length, events: okEvents.length, flyers: (flyers || []).length },
        recipients: messages.length,
        alreadySent: already.size,
        sample: messages[0] ? { to: messages[0].payload.to, subject: messages[0].payload.subject, html: messages[0].payload.html } : null,
      });
    }

    // ── send in batches; log each batch only after Resend accepted it ──
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < messages.length; i += BATCH) {
      const chunk = messages.slice(i, i + BATCH);
      try {
        await sendBatch(chunk.map((m) => m.payload));
        sent += chunk.length;
        const { error } = await admin.from("digest_log").insert(chunk.map((m) => ({ user_id: m.userId, week_start: weekStart })));
        if (error) console.error("digest: log insert failed", error.message);
      } catch (e) {
        failed += chunk.length;
        console.error("digest: batch failed", e.message);
      }
    }
    return res.status(200).json({ weekStart, sent, failed, skipped: already.size });
  } catch (e) {
    console.error("digest: error", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
