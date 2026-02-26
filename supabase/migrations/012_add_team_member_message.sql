-- Add message column to team_members for join request applications
ALTER TABLE public.team_members
ADD COLUMN message TEXT;
