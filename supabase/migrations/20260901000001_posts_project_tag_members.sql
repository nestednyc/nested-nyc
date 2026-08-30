-- ============================================================
-- Posting about a project: anyone ON the project can tag it — the
-- owner, co-leads (is_project_admin) AND approved crew — not just
-- the leads. Same gate on INSERT and on edit.
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_tag_project(p_project UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_project_admin(p_project)
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.project_id = p_project
          AND tm.user_id = auth.uid()
          AND tm.status = 'approved'
      );
$$;
REVOKE ALL ON FUNCTION public.can_tag_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_tag_project(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users create own posts" ON public.posts;
CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (project_id IS NULL OR public.can_tag_project(project_id))
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

DROP POLICY IF EXISTS "Users edit own posts" ON public.posts;
CREATE POLICY "Users edit own posts"
  ON public.posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
    AND (project_id IS NULL OR public.can_tag_project(project_id))
  );

NOTIFY pgrst, 'reload schema';
