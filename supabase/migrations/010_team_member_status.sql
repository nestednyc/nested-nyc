-- Add status column to team_members for pending/approved join flow
-- Run this in Supabase SQL Editor

-- Add status column to team_members
ALTER TABLE public.team_members
ADD COLUMN status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Set existing members to approved (they were added before this system)
UPDATE public.team_members SET status = 'approved' WHERE status IS NULL;

-- Make status NOT NULL after backfill
ALTER TABLE public.team_members ALTER COLUMN status SET NOT NULL;

-- Add index for efficient filtering by status
CREATE INDEX idx_team_members_status ON public.team_members(status);
CREATE INDEX idx_team_members_project_status ON public.team_members(project_id, status);
