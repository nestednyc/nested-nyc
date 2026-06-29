/* ============================================================
   NESTED NYC — transactional email sender (webhook receiver)
   ------------------------------------------------------------
   Supabase Database Webhooks POST row changes here; we map each
   change to one of the Phase-1 emails (api/_email/template.js)
   and send it through Resend.

   Auth: the webhooks send a shared `x-webhook-secret` header.
   Recipient emails live in auth.users (not profiles), so we read
   them with a service-role client. Each recipient is checked for
   email_opt_out and gets a per-person one-click unsubscribe link.

   Returns 200 for ignored events, opted-out / unreachable
   recipients, AND after a delivery attempt (failures are logged)
   — favouring "no duplicate emails" over retry-on-failure, since
   Supabase retries any non-2xx. A 500 is reserved for pre-send
   errors (bad payload / DB unreachable), which are safe to retry.
   ============================================================ */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { emails } from "./_email/template.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Vercel env var is named RESEND_VERCEL_KEY (a separate Resend key from the one
// Supabase Auth's SMTP uses). Fall back to the conventional name so either works.
const RESEND_API_KEY = process.env.RESEND_VERCEL_KEY || process.env.RESEND_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const EMAIL_FROM = process.env.EMAIL_FROM || "Nested <hi@nested.social>";
const APP_URL = process.env.APP_URL || "https://www.nested.social";
const UNSUB_SECRET = process.env.UNSUBSCRIBE_SECRET || WEBHOOK_SECRET || "";

const admin =
  SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// ── helpers ────────────────────────────────────────────────
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

function fullName(p) {
  const n = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
  return n || p?.username || "Someone";
}

function unsubUrl(userId) {
  const t = crypto.createHmac("sha256", UNSUB_SECRET).update(String(userId)).digest("hex");
  return `${APP_URL}/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${t}`;
}

// { email, profile, optOut } for a user id, or null if no email / unreachable.
async function getRecipient(userId) {
  if (!userId || !admin) return null;
  const [{ data: u }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("profiles")
      .select("first_name,last_name,username,university,email_opt_out")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const email = u?.user?.email || null;
  if (!email) return null;
  return { email, profile: profile || {}, optOut: !!profile?.email_opt_out };
}

async function sendEmail(to, list, { subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      headers: {
        "List-Unsubscribe": `<${list}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ── per-table planners: { recipientIds, make(unsubUrl) -> {subject,html} } ──
async function planJoinRequest(tm) {
  if (!tm || tm.status !== "pending") return null;
  const { data: project } = await admin
    .from("projects")
    .select("id,name,owner_id,admins")
    .eq("id", tm.project_id)
    .maybeSingle();
  if (!project) return null;

  // `admins` already contains the owner (DB-backfilled) plus any co-leads.
  // Notify all of them except the requester.
  const ids = Array.from(
    new Set([project.owner_id, ...(project.admins || [])].filter(Boolean).map(String))
  );
  const recipientIds = ids.filter((id) => id !== String(tm.user_id));
  if (!recipientIds.length) return null;

  return {
    recipientIds,
    make: (unsub) =>
      emails.joinRequest({
        requesterName: tm.name || "A student",
        school: tm.school || "",
        role: tm.role || "",
        projectTitle: project.name || "your project",
        projectId: project.id,
        message: tm.message || "",
        unsubUrl: unsub,
      }),
  };
}

async function planJoinApproved(tm, old) {
  if (!tm || tm.status !== "approved") return null;
  if (old && old.status === "approved") return null; // only the pending → approved flip
  if (!tm.user_id) return null;

  const { data: project } = await admin
    .from("projects")
    .select("id,name,owner_id")
    .eq("id", tm.project_id)
    .maybeSingle();
  if (!project) return null;

  let ownerName = "The project lead";
  if (project.owner_id) {
    const { data: owner } = await admin
      .from("profiles")
      .select("first_name,last_name,username")
      .eq("id", project.owner_id)
      .maybeSingle();
    if (owner) ownerName = fullName(owner);
  }

  return {
    recipientIds: [String(tm.user_id)],
    make: (unsub) =>
      emails.joinApproved({
        ownerName,
        role: tm.role || "",
        projectTitle: project.name || "the project",
        projectId: project.id,
        unsubUrl: unsub,
      }),
  };
}

async function planNewConnection(c) {
  if (!c || !c.target_id || !c.user_id) return null;

  // Dedupe: email a given source→target connection only ONCE, even across
  // connect → disconnect → reconnect churn (connection_notify_log persists; it is
  // never deleted). We only CHECK here — the marker is committed in the handler's
  // onSent, AFTER a confirmed send — so a transient send failure or an opt-out
  // can't permanently suppress the first email; a later reconnect still delivers
  // it. (One webhook per pair per connect + the connections PK ⇒ no concurrent-
  // send race here.)
  const { data: already } = await admin
    .from("connection_notify_log")
    .select("user_id")
    .eq("user_id", c.user_id)
    .eq("target_id", c.target_id)
    .maybeSingle();
  if (already) return null; // already emailed this pair

  const { data: source } = await admin
    .from("profiles")
    .select("first_name,last_name,username,university")
    .eq("id", c.user_id)
    .maybeSingle();

  return {
    recipientIds: [String(c.target_id)],
    make: (unsub) =>
      emails.newConnection({
        sourceName: fullName(source),
        school: source?.university || "",
        sourceUsername: source?.username || "",
        unsubUrl: unsub,
      }),
    // Record the dedupe marker only once the email has actually gone out.
    onSent: async () => {
      await admin
        .from("connection_notify_log")
        .insert({ user_id: c.user_id, target_id: c.target_id });
    },
  };
}

// → recipient: the FIRST direct message of a pair (one email per conversation, ever).
// `m` is the inserted public.messages row from the webhook (id, sender_id,
// recipient_id, created_at all present; body_enc is ignored — no plaintext leaves DB).
async function planNewMessage(m) {
  const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ""));
  if (!m || !isUuid(m.sender_id) || !isUuid(m.recipient_id) || !m.created_at) return null;
  if (m.sender_id === m.recipient_id) return null;

  // 1. DEDUPE AUTHORITY — already emailed this (unordered) pair? Mirrors
  // planNewConnection's up-front connection_notify_log check. This is what makes the
  // notification idempotent against a duplicate / at-least-once webhook delivery of
  // the same first message: the messages-table check (step 2) alone would re-fire,
  // because that one message still has nothing earlier than itself. Fail CLOSED on a
  // query error — a missed notification beats a wrong/duplicate one.
  // (Residual: A→B and B→A opening a pair within the same few ms can both pass before
  // either logs → 2 legit emails to the 2 participants; vanishingly rare, accepted.)
  const { data: already, error: dedupeErr } = await admin
    .from("message_notify_log")
    .select("sender_id")
    .or(
      `and(sender_id.eq.${m.sender_id},recipient_id.eq.${m.recipient_id}),` +
      `and(sender_id.eq.${m.recipient_id},recipient_id.eq.${m.sender_id})`
    )
    .limit(1)
    .maybeSingle();
  if (dedupeErr) return null;
  if (already) return null; // this pair has already been emailed

  // 2. LAUNCH-BLAST GUARD — is this actually the first message of the pair? Decided
  // against the messages table (NOT the log) so flipping the webhook on does not
  // email every EXISTING conversation: those have earlier messages, and the log is
  // empty at switch-on. Keep BOTH checks — the log (step 1) is the dedupe authority,
  // this is the pre-existing-history guard. Service-role `admin` bypasses RLS. Fail
  // CLOSED on error. Two-arm OR on the (sender,recipient,created_at) index.
  const { data: earlier, error: firstErr } = await admin
    .from("messages")
    .select("id")
    .or(
      `and(sender_id.eq.${m.sender_id},recipient_id.eq.${m.recipient_id}),` +
      `and(sender_id.eq.${m.recipient_id},recipient_id.eq.${m.sender_id})`
    )
    .lt("created_at", m.created_at)
    .limit(1)
    .maybeSingle();
  if (firstErr) return null;
  if (earlier) return null; // not the first message in this pair

  // 3. SPRAY CEILING — cap how many distinct new conversations one sender can EMAIL in
  // a rolling hour (mirrors the connections 100/hr email-spray cap). Suppresses the
  // email only — the message itself already delivered. Fail CLOSED on error.
  // (Best-effort: concurrent sends can overshoot the cap by a few at the boundary.)
  const SENDER_HOURLY_CAP = 100;
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: capErr } = await admin
    .from("message_notify_log")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", m.sender_id)
    .gt("notified_at", sinceIso);
  if (capErr) return null;
  if ((count || 0) >= SENDER_HOURLY_CAP) {
    console.warn("notify: first-message email spray cap hit for sender", m.sender_id);
    return null;
  }

  const { data: source } = await admin
    .from("profiles")
    .select("first_name,last_name,username,university")
    .eq("id", m.sender_id)
    .maybeSingle();

  return {
    recipientIds: [String(m.recipient_id)],
    make: (unsub) =>
      emails.newMessage({
        senderName: fullName(source),
        school: source?.university || "",
        senderUsername: source?.username || "",
        unsubUrl: unsub,
      }),
    // Mark the pair notified only after a confirmed send; the UNIQUE unordered-pair
    // index turns a concurrent/retry double into a caught 23505 (best-effort).
    onSent: async () => {
      await admin
        .from("message_notify_log")
        .insert({ sender_id: m.sender_id, recipient_id: m.recipient_id });
    },
  };
}

async function planOrgVerified(org, old) {
  if (!org || org.verified !== true) return null;
  if (old && old.verified === true) return null; // only the false → true flip
  if (!org.owner_user_id) return null;

  return {
    recipientIds: [String(org.owner_user_id)],
    make: (unsub) =>
      emails.orgVerified({
        orgName: org.name || "Your organization",
        unsubUrl: unsub,
      }),
  };
}

async function planFor({ type, table, record, old_record }) {
  if (table === "team_members") {
    if (type === "INSERT") return planJoinRequest(record);
    if (type === "UPDATE") return planJoinApproved(record, old_record);
    return null;
  }
  if (table === "connections" && type === "INSERT") return planNewConnection(record);
  if (table === "organizations" && type === "UPDATE") return planOrgVerified(record, old_record);
  if (table === "messages" && type === "INSERT") return planNewMessage(record);
  return null;
}

// ── handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!secretsMatch(header(req, "x-webhook-secret"), WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!admin || !RESEND_API_KEY) {
    console.error("notify: missing env (SUPABASE_URL / SERVICE_ROLE_KEY / RESEND_API_KEY)");
    return res.status(500).json({ error: "Server not configured" });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  if (!payload || !payload.table || !payload.type) {
    return res.status(400).json({ error: "Bad payload" });
  }

  try {
    const plan = await planFor(payload);
    if (!plan || !plan.recipientIds.length) {
      return res.status(200).json({ skipped: true });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const rid of plan.recipientIds) {
      const r = await getRecipient(rid);
      if (!r || r.optOut) {
        skipped++;
        continue;
      }
      const link = unsubUrl(rid);
      try {
        await sendEmail(r.email, link, plan.make(link));
        sent++;
        // Commit any post-send marker (e.g. the connection dedupe) only now that
        // the email actually went out. Best-effort: a marker hiccup must not fail
        // the request or double-count the send.
        if (plan.onSent) {
          try { await plan.onSent(rid); }
          catch (e2) { console.error("notify: onSent failed for", rid, e2.message); }
        }
      } catch (e) {
        failed++;
        console.error("notify: send failed for", rid, e.message);
      }
    }
    // 200 even with per-recipient failures: avoids webhook-retry storms /
    // duplicate sends. Pre-send failures throw below and return 500 (retryable).
    return res.status(200).json({ sent, skipped, failed });
  } catch (e) {
    console.error("notify: error", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
