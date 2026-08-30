-- ============================================================
-- posts.is_first — "New on the board": a student's first-ever post.
-- Set once at insert (BEFORE INSERT trigger), never recomputed, so the
-- badge is a fact about the moment, not a moving target. Org posts
-- never get it (an org's first post isn't a newcomer moment).
-- Backfills existing rows by created_at order.
-- ============================================================
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_first BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.posts_mark_first()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.is_first := NOT EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.author_id = NEW.author_id AND p.org_id IS NULL
    );
  ELSE
    NEW.is_first := FALSE;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_posts_mark_first ON public.posts;
CREATE TRIGGER aa_posts_mark_first
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_mark_first();

UPDATE public.posts p
SET is_first = NOT EXISTS (
  SELECT 1 FROM public.posts q
  WHERE q.author_id = p.author_id AND q.org_id IS NULL AND q.created_at < p.created_at
)
WHERE p.org_id IS NULL;

NOTIFY pgrst, 'reload schema';
