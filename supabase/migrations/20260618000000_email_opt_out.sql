-- ============================================================
-- Email opt-out: a single flag the notification sender checks
-- before sending any transactional email (api/notify.js), and
-- the target of the one-click unsubscribe endpoint
-- (api/unsubscribe.js). One boolean = "stop all Nested emails."
--
-- Per-category preferences can come later; for now the email
-- footer's "Manage email preferences" link flips this. Writes go
-- through the service role (the unsubscribe endpoint), so no RLS
-- change is needed — and profiles' existing self-update policy
-- would also let a future in-app toggle set it (account_type
-- stays the only server-locked column).
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
