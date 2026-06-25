/* ============================================================
   NESTED NYC — email unsubscribe (prefetch-safe)
   ------------------------------------------------------------
   Target of every email's footer link + List-Unsubscribe header.
   The link carries an HMAC token (?u=<id>&t=<hmac>) so nobody can
   opt someone else out by guessing UUIDs.

   GET  is READ-ONLY — it renders a confirmation page with a button
        and changes NOTHING. This matters because .edu mail systems
        aggressively pre-fetch links with security scanners
        (Proofpoint / Defender Safe Links / Barracuda …); a GET that
        mutated state would unsubscribe students who never clicked.
   POST is the only thing that flips profiles.email_opt_out — fired
        by that button OR by a provider's RFC-8058 one-click button
        (Gmail/Yahoo). Scanners only ever GET/HEAD, so they're safe.

   The HMAC token doubles as CSRF protection: a cross-site POST
   can't forge it without the server secret.
   ============================================================ */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { limit, clientIp } from "./_rate-limit.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNSUB_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.WEBHOOK_SECRET || "";

const admin =
  SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

function validToken(userId, t) {
  if (!userId || !t || !UNSUB_SECRET) return false;
  const expected = crypto.createHmac("sha256", UNSUB_SECRET).update(String(userId)).digest("hex");
  const a = Buffer.from(String(t));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// HTML-attribute-safe (used for the form action + resubscribe href).
function attr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function selfUrl(userId, t, action) {
  const base = `/api/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(t)}`;
  return action ? `${base}&action=${action}` : base;
}

function shell(title, inner) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title></head>
<body style="margin:0;background:#F0EEE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:480px;margin:64px auto;padding:0 18px;">
  <div style="font-weight:800;font-size:18px;color:#23211C;letter-spacing:-0.02em;margin-bottom:22px;">nested<span style="color:#DB5338;">.</span>social</div>
  <div style="background:#FCFBF8;border:1px solid #E7E3D7;border-radius:14px;padding:30px 28px;">
    ${inner}
  </div>
</div></body></html>`;
}

function note(title, bodyHtml) {
  return shell(
    title,
    `<h1 style="margin:0 0 10px;font-size:22px;color:#23211C;">${title}</h1>
     <p style="margin:0;font-size:15px;line-height:1.6;color:#56514A;">${bodyHtml}</p>`
  );
}

function confirm(title, body, postUrl, button) {
  return shell(
    title,
    `<h1 style="margin:0 0 10px;font-size:22px;color:#23211C;">${title}</h1>
     <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#56514A;">${body}</p>
     <form method="POST" action="${attr(postUrl)}" style="margin:0;">
       <button type="submit" style="display:inline-block;border:0;cursor:pointer;padding:12px 22px;border-radius:10px;background:#DB5338;color:#FCFBF8;font-size:15px;font-weight:700;">${button}</button>
     </form>`
  );
}

async function setOptOut(userId, value) {
  return admin.from("profiles").update({ email_opt_out: value }).eq("id", userId);
}

export default async function handler(req, res) {
  const q = req.query || {};
  const userId = first(q.u);
  const t = first(q.t);
  const action = first(q.action);
  const method = (req.method || "GET").toUpperCase();

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!admin) {
    return res.status(500).send(note("Something went wrong", "Email preferences are temporarily unavailable. Please try again later."));
  }
  if (!validToken(userId, t)) {
    return res.status(400).send(note("Invalid link", "This unsubscribe link is invalid or has expired."));
  }

  // GET / HEAD — read-only confirmation page. NOTHING is mutated here, so
  // .edu link-prefetch scanners can't accidentally change anyone's prefs.
  if (method !== "POST") {
    if (action === "resubscribe") {
      return res.status(200).send(
        confirm(
          "Resubscribe to Nested emails?",
          "You'll start receiving Nested notification emails again.",
          selfUrl(userId, t, "resubscribe"),
          "Resubscribe me"
        )
      );
    }
    return res.status(200).send(
      confirm(
        "Unsubscribe from Nested emails?",
        "Click below to stop receiving Nested notification emails — join requests, approvals, new connections, and org updates.",
        selfUrl(userId, t),
        "Unsubscribe me"
      )
    );
  }

  // POST — the actual change. Fired by the button above OR by a provider's
  // RFC-8058 one-click unsubscribe. The HMAC token already gates this; the
  // per-IP cap just stops hammering.
  if (!(await limit(`unsubscribe:${clientIp(req)}`, 20, 60))) {
    return res.status(429).send(note("Too many requests", "Please wait a moment and try again."));
  }
  if (action === "resubscribe") {
    const { error } = await setOptOut(userId, false);
    if (error) return res.status(500).send(note("Something went wrong", "We couldn't update your preferences. Please try again."));
    return res.status(200).send(note("You're resubscribed", "You'll receive Nested notification emails again."));
  }

  const { error } = await setOptOut(userId, true);
  if (error) return res.status(500).send(note("Something went wrong", "We couldn't update your preferences. Please try again."));
  const resub = selfUrl(userId, t, "resubscribe");
  return res.status(200).send(
    note(
      "You've been unsubscribed",
      `You won't receive Nested notification emails anymore. Changed your mind? <a href="${attr(resub)}" style="color:#A6391F;">Resubscribe</a>.`
    )
  );
}
