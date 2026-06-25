/* ============================================================
   NESTED NYC — shared per-IP rate limiter for the api/ layer
   ------------------------------------------------------------
   RLS/RPCs only ever see auth.uid(), never the caller's IP, so
   per-IP throttling for the public/anon endpoints has to live at
   the edge. This wraps the rate_limit_hit() SQL function (an atomic
   fixed-window counter; see 20260625000001_write_rate_limits.sql)
   with the SERVICE-ROLE key — the only role allowed to call it.

   Fails OPEN: if the limiter backend is unreachable we allow the
   request. These endpoints (prerender / sitemap / unsubscribe /
   check-email) favour availability over strict enforcement; the
   hard limits that must fail closed live in Postgres triggers.
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin =
  SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// Best-effort fixed-window check. Returns true when the call is ALLOWED.
export async function limit(key, max, windowSec) {
  if (!admin) return true; // misconfigured → fail open
  try {
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_sec: windowSec,
    });
    if (error) return true; // backend hiccup → fail open
    return data === true;
  } catch {
    return true; // network/exception → fail open
  }
}

// The first hop in X-Forwarded-For is the real client on Vercel. Fall back to
// the socket address; "unknown" is a last resort (would share one bucket, but
// Vercel always sets XFF in practice).
export function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  const ip = raw ? String(raw).split(",")[0].trim() : "";
  return ip || req.socket?.remoteAddress || "unknown";
}
