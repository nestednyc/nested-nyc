-- Usernames are stored BARE — the "@" is a display prefix the UI and the
-- notification emails add. Verified 2026-07-18: no prod row violates this
-- (0 of 56), so there is nothing to clean; this only pins the invariant.
--
-- Why at the DB: RLS lets a user UPDATE their own profiles row straight
-- through the REST API, skipping the client's validateUsernameFormat — the
-- constraint is the only server-side enforcement. NOT VALID: existing rows
-- are never re-scanned; new/updated rows are checked (NULL passes — signup
-- creates the row without a username, onboarding fills it in).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_no_leading_at;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_no_leading_at
  CHECK (username !~ '^@') NOT VALID;
