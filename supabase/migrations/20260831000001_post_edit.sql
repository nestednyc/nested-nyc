-- ============================================================
-- Post editing: the author can change a note's words, kind and
-- project tag after pinning it. Column-level UPDATE grant keeps
-- the counters (like_count / comment_count / report_count), the
-- author snapshot, org_id and is_first out of reach; edited_at
-- is stamped by a trigger so "· edited" can't be faked or hidden.
-- ============================================================
GRANT UPDATE (body, kind, project_id) ON public.posts TO authenticated;
DROP POLICY IF EXISTS "Users edit own posts" ON public.posts;
CREATE POLICY "Users edit own posts"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
    -- the project tag must be one the author leads (owner / co-lead)
    AND (project_id IS NULL OR public.is_project_admin(project_id))
  );

-- Same gate on INSERT (20260829000000 only checked the author + the org gate).
DROP POLICY IF EXISTS "Users create own posts" ON public.posts;
CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (project_id IS NULL OR public.is_project_admin(project_id))
    AND (
      org_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = org_id
          AND o.owner_user_id = auth.uid()
          AND o.verified = TRUE
      )
    )
  );

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.posts_stamp_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Words or kind changed, or a NEW project tag was set. A tag going to NULL
  -- is not stamped: that's also what ON DELETE SET NULL does when a flyer is
  -- deleted, and nobody edited those notes.
  IF NEW.body IS DISTINCT FROM OLD.body
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR (NEW.project_id IS DISTINCT FROM OLD.project_id AND NEW.project_id IS NOT NULL) THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS posts_stamp_edit ON public.posts;
CREATE TRIGGER posts_stamp_edit
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_stamp_edit();

NOTIFY pgrst, 'reload schema';
