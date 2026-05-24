-- Saved projects: users bookmarking projects to revisit on the My Projects screen
CREATE TABLE IF NOT EXISTS public.saved_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_projects_user ON public.saved_projects(user_id);

ALTER TABLE public.saved_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saved projects"
  ON public.saved_projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users save projects"
  ON public.saved_projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unsave projects"
  ON public.saved_projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
