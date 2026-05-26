-- Add a short headline (one-liner above the bio) to profiles.
-- Bio is freeform and often long; the headline is the social hook shown
-- next to the name on profile cards and in the public profile view.
--
-- Length is capped at 120 chars at the DB layer (defense in depth — the
-- UI also enforces the same limit).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS headline TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_headline_length_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_headline_length_check
  CHECK (headline IS NULL OR char_length(headline) <= 120);

-- Re-create the public_profiles view to expose `headline` to anon viewers.
-- Anything we add here is readable by unauthenticated visitors.
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id,
  first_name,
  last_name,
  username,
  avatar,
  university,
  headline
FROM public.profiles
WHERE onboarding_completed = TRUE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
