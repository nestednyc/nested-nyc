-- ============================================================
-- Report / flag: students can report a post, a comment, or a
-- profile. Reports are write-only for users (no SELECT — nobody
-- can see who reported what); the founders are emailed by the
-- notify webhook (api/notify.js planNewReport) and read the table
-- with the service role.
-- ------------------------------------------------------------
-- Auto-hide: posts / comments carry a trigger-maintained
-- report_count; the feed queries skip rows at >= 3 distinct
-- reports (each reporter counts once — UNIQUE per target). Nothing
-- is deleted — a founder can review and clear the count.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'profile')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports (target_type, target_id);

-- Write-only for users. No SELECT grant: the reporter list is private.
GRANT INSERT ON public.reports TO authenticated;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users file reports as themselves"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- ---------------- auto-hide counters ----------------
ALTER TABLE public.posts         ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.reports_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'post' THEN
      UPDATE public.posts SET report_count = report_count + 1 WHERE id = NEW.target_id;
    ELSIF NEW.target_type = 'comment' THEN
      UPDATE public.post_comments SET report_count = report_count + 1 WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- a reporter's account going away takes their reports with it
    IF OLD.target_type = 'post' THEN
      UPDATE public.posts SET report_count = GREATEST(report_count - 1, 0) WHERE id = OLD.target_id;
    ELSIF OLD.target_type = 'comment' THEN
      UPDATE public.post_comments SET report_count = GREATEST(report_count - 1, 0) WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reports_counter ON public.reports;
CREATE TRIGGER reports_counter
  AFTER INSERT OR DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_counter();

-- ---------------- rate limit (mirror rl_posts) ----------------
CREATE OR REPLACE FUNCTION public.rl_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.reporter_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.reports r
  WHERE r.reporter_id = v_uid AND r.created_at > now() - interval '1 hour';
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_rl_reports ON public.reports;
CREATE TRIGGER zz_rl_reports
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.rl_reports();

NOTIFY pgrst, 'reload schema';
