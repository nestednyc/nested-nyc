-- ============================================================
-- Write-path rate limits + abuse controls
-- ------------------------------------------------------------
-- Adds the rate limiting the audit found missing. Mirrors the send_message
-- pattern (20260622000000): count the actor's recent rows in a rolling window
-- inside a SECURITY DEFINER routine and RAISE EXCEPTION ... ERRCODE 'PT429', so
-- PostgREST returns HTTP 429 and the services branch on error.code (see
-- messageService.messageForError / the PT429 maps added in this change).
--
-- Three layers ship here:
--   1. BEFORE INSERT triggers on the writes that fire victim emails or enable
--      spam: team_members (pending join requests), connections,
--      event_registrations. Direct client INSERTs + their RLS stay unchanged —
--      the trigger only caps the rate, so no client rewrite is needed.
--   2. A generic IP limiter for the Vercel api/ layer: rate_limit_hit() + a
--      rate_limits table, called with the SERVICE-ROLE key from
--      api/_rate-limit.js. RLS/RPCs only ever see auth.uid(), never the client
--      IP, so per-IP limits for anon endpoints have to be driven from the edge.
--   3. connection_notify_log so api/notify.js emails a given source->target
--      connection only once, even across connect/disconnect/reconnect churn
--      (the connections row is deleted on disconnect, so a per-row flag wouldn't
--      survive — this log is never deleted).
--
-- Plus: REVOKE anon on check_email_exists so the only email-existence path is
-- the per-IP-rate-limited /api/check-email proxy.
--
-- NOTE: trigger functions intentionally keep Supabase's default EXECUTE grants.
-- A trigger fires regardless of the invoking role's EXECUTE privilege, and a
-- direct RPC call to a TRIGGER-returning function just errors (no NEW) — so
-- revoking buys nothing and risks masking a misfire. Only the *callable*
-- functions (rate_limit_hit, check_email_exists) have their grants tightened.
-- ============================================================

-- ---------------- trigger: team_members (pending join requests) ----------------
-- Only self-initiated PENDING rows are capped (the join-request-spam / owner-
-- email-bomb vector). Creator stamps insert status='approved' (projectAdapter.js)
-- and approvals/rejections are UPDATEs, so neither legit path is ever throttled.
CREATE OR REPLACE FUNCTION public.rl_team_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL
     OR NEW.user_id IS DISTINCT FROM v_uid
     OR COALESCE(NEW.status, '') <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Count only the actor's recent PENDING join requests — the population this cap
  -- actually throttles. Without the status filter, the status='approved' creator
  -- self-stamp from each project they create would erode the join-request budget.
  -- DEFINER so the count bypasses team_members read-RLS and sees all of them.
  SELECT COUNT(*) INTO v_count
  FROM public.team_members tm
  WHERE tm.user_id = v_uid
    AND tm.status = 'pending'
    AND tm.joined_at > now() - interval '1 hour';

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_rl_team_members ON public.team_members;
CREATE TRIGGER zz_rl_team_members
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.rl_team_members();

-- ---------------- trigger: connections ----------------
-- Connections are normal, bursty behavior (browsing People, post-event adds), so
-- this is an ABUSE backstop, not a throttle on real use: no per-minute cap, and a
-- high hourly ceiling. Note the connection_notify_log dedupe (api/notify.js) only
-- stops re-emailing the SAME pair (connect/disconnect/reconnect churn); this
-- hourly cap is what bounds emailing many DISTINCT targets, so it doubles as the
-- "new connection" email-spray ceiling (<=100 first-contact emails/hr per account).
-- Keyed on the connector (INSERT RLS forces user_id = auth.uid()). Tune if abuse appears.
CREATE OR REPLACE FUNCTION public.rl_connections()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.user_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.connections c
  WHERE c.user_id = v_uid
    AND c.created_at > now() - interval '1 hour';
  IF v_count >= 100 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_rl_connections ON public.connections;
CREATE TRIGGER zz_rl_connections
  BEFORE INSERT ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.rl_connections();

-- ---------------- trigger: event_registrations ----------------
-- No email fires on RSVP, but unbounded RSVP churn spams attendee counts /
-- notifications. 30/hr per user is far above any real attendee.
CREATE OR REPLACE FUNCTION public.rl_event_registrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.user_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.event_registrations er
  WHERE er.user_id = v_uid
    AND er.registered_at > now() - interval '1 hour';

  IF v_count >= 30 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_rl_event_registrations ON public.event_registrations;
CREATE TRIGGER zz_rl_event_registrations
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.rl_event_registrations();

-- ---------------- trigger: events (org event creation) ----------------
-- Orgs' write surface. RLS already restricts INSERT to a VERIFIED org's owner
-- (organizer_id = auth.uid()); this caps how fast that owner can mint events so a
-- compromised/abusive org can't flood the feed. Students never reach this path.
CREATE OR REPLACE FUNCTION public.rl_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.organizer_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.events e
  WHERE e.organizer_id = v_uid
    AND e.created_at > now() - interval '1 hour';

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_rl_events ON public.events;
CREATE TRIGGER zz_rl_events
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.rl_events();

-- ---------------- generic IP limiter (Vercel api/ layer) ----------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count        INT NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies -> anon/authenticated have zero access; service_role bypasses RLS.

-- Atomic fixed-window counter. Returns TRUE when the call is ALLOWED. The
-- ON CONFLICT path resets the window once it has elapsed, else increments —
-- both under the row lock, so concurrent hits can't race past the cap.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key TEXT, p_max INT, p_window_sec INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Opportunistic cleanup (~1% of calls) so the table can't accumulate a
  -- permanent row per distinct IP ever seen. Safe: any ACTIVE limiter row is
  -- refreshed within its (seconds-long) window, far under the 1-day cutoff.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  INSERT INTO public.rate_limits AS rl (key, window_start, count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE WHEN rl.window_start < now() - make_interval(secs => p_window_sec)
                     THEN 1 ELSE rl.count + 1 END,
        window_start = CASE WHEN rl.window_start < now() - make_interval(secs => p_window_sec)
                            THEN now() ELSE rl.window_start END
  RETURNING rl.count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Only the service-role Vercel layer may call this. (service_role keeps its
-- default grant; the PUBLIC/anon/authenticated grants Supabase adds are dropped.)
REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;

-- ---------------- connection email dedupe ----------------
-- api/notify.js inserts (user_id, target_id) here before emailing a new
-- connection; a 23505 means we've emailed this pair before -> skip the send.
CREATE TABLE IF NOT EXISTS public.connection_notify_log (
  user_id     UUID NOT NULL,
  target_id   UUID NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_id)
);
ALTER TABLE public.connection_notify_log ENABLE ROW LEVEL SECURITY;
-- No policies -> only the service-role notify function touches it.

-- ---------------- close the email-enumeration hole ----------------
-- check_email_exists stays for the signup "you already have an account" hint,
-- but only via the per-IP-rate-limited /api/check-email proxy (service-role).
-- Drop the anon grant so it can't be hammered directly at /rest/v1/rpc.
-- authenticated keeps it (an account already exists — nothing leaked).
REVOKE EXECUTE ON FUNCTION public.check_email_exists(TEXT) FROM PUBLIC, anon;

-- NOTE: the sibling check_username_available is intentionally LEFT anon-callable.
-- Usernames are already public (the /u/:username pages + the public_profiles view
-- enumerate them), so it leaks nothing, and it's a cheap LOWER(username) index
-- probe (profiles_username_unique_idx, migration 007). The onboarding username
-- field calls it live (debounced) on the anon client, so proxying it like
-- check_email_exists would add latency for no confidentiality gain.

NOTIFY pgrst, 'reload schema';
