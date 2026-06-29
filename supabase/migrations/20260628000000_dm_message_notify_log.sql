-- ─────────────────────────────────────────────────────────────────────────────
-- First-direct-message email — per-pair notify log (dedupe guard + spray cap)
--
-- Companion to the messages-INSERT Supabase webhook → /api/notify (planNewMessage).
-- The "is this the first message of the pair?" decision is made against the
-- `messages` table itself (an earlier row in EITHER direction ⇒ not first), so an
-- empty log can never blast existing conversations when the webhook is switched
-- on — no backfill needed. This table is the SECONDARY guard:
--   1. the UNIQUE unordered-pair index makes a concurrent / webhook-retry double
--      send a caught 23505 (best-effort once-per-pair), and
--   2. the (sender_id, notified_at) index backs the per-sender hourly spray cap in
--      api/notify.js (≤ N first-contact emails/hr per account — the email-spray
--      ceiling, mirroring rl_connections; it suppresses the EMAIL, not the message).
--
-- Mirrors public.connection_notify_log (20260625000001) but keyed on the UNORDERED
-- pair: A→B and B→A are the same conversation, so once either direction has
-- notified, the other never does (matches "first text between two users").
--
-- RLS enabled with NO policies ⇒ only the service-role api/notify.js client touches
-- it; anon / authenticated get nothing.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.message_notify_log (
  sender_id    UUID NOT NULL,
  recipient_id UUID NOT NULL,
  notified_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One notify per unordered pair, ever.
CREATE UNIQUE INDEX IF NOT EXISTS message_notify_log_pair_uniq
  ON public.message_notify_log (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id));

-- Per-sender hourly cap lookups (the email-spray ceiling).
CREATE INDEX IF NOT EXISTS message_notify_log_sender_time
  ON public.message_notify_log (sender_id, notified_at DESC);

ALTER TABLE public.message_notify_log ENABLE ROW LEVEL SECURITY;
