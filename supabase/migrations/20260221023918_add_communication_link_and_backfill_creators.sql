-- Add communication_link column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS communication_link TEXT;

-- Backfill: insert project creators into team_members where missing
INSERT INTO public.team_members (project_id, user_id, name, school, role, status)
SELECT p.id, p.owner_id, p.author_name, p.university, 'Creator', 'approved'
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.project_id = p.id AND tm.user_id = p.owner_id
);
