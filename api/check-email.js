/* ============================================================
   NESTED NYC — email-existence check (rate-limited proxy)
   ------------------------------------------------------------
   The signup flow asks "is this email already registered?" to show
   a "you already have an account — sign in" hint. That check reads
   auth.users, so it used to be an anon RPC (check_email_exists) —
   i.e. an unauthenticated, unbounded email-enumeration oracle.

   This proxy is now the ONLY path: anon EXECUTE on the RPC was
   revoked (20260625000001), so the function runs here behind the
   service-role key + a per-IP rate limit. Bulk enumeration is
   throttled; a real signup's one or two checks sail through.

   Fails OPEN to { exists: false } on any error so signup is never
   blocked by this hint — Supabase still enforces email uniqueness.
   In local `vite` dev there is no Vercel runtime, so the client's
   fetch 404s and the caller (lookupService) also fails open.
   ============================================================ */
import { createClient } from "@supabase/supabase-js";
import { limit, clientIp } from "./_rate-limit.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin =
  SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Misconfigured (no service role) → fail open; signup proceeds without the hint.
  if (!admin) return res.status(200).json({ exists: false });

  // 60 checks / 10 min / IP. Raised from a single-user figure to tolerate campus
  // NAT (many students behind one egress IP) during a signup wave — consistent
  // with the [auth.rate_limit] NAT tuning — while still throttling enumeration.
  // The caller fails open (signup proceeds without the "already have an account"
  // hint), so erring generous here is safe.
  const ok = await limit(`check-email:${clientIp(req)}`, 60, 600);
  if (!ok) return res.status(429).json({ error: "rate_limited" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const email =
    body && typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email) return res.status(400).json({ error: "bad_request" });

  try {
    const { data, error } = await admin.rpc("check_email_exists", {
      email_to_check: email,
    });
    if (error) return res.status(200).json({ exists: false }); // fail open
    return res.status(200).json({ exists: data === true });
  } catch {
    return res.status(200).json({ exists: false }); // fail open
  }
}
