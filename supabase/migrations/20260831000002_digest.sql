-- ============================================================
-- Weekly digest ("This week on the board at <school>"), sent by
-- the Vercel cron at api/digest.js.
-- ------------------------------------------------------------
-- profiles.digest_opt_out — per-kind opt-out for the digest only
--   (profiles.email_opt_out still silences everything, digest included).
-- digest_log — one row per user × week so a re-run of the cron can't
--   double-send. Service-role only (RLS on, no policies).
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS digest_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.digest_log (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);
ALTER TABLE public.digest_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digest_log FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
