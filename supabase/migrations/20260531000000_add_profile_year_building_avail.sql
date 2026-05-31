-- Adds three optional self-description fields to profiles. The cork-board
-- profile renders them inline; future onboarding/editor flows on origin/main
-- can adopt them when this branch merges.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS year TEXT,
  ADD COLUMN IF NOT EXISTS building TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT;
