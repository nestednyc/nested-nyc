-- RLS policy updates for team member status workflow
-- Run this AFTER 010_team_member_status.sql

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Users can join projects" ON public.team_members;

-- Users can only insert themselves with 'pending' status
-- This ensures join requests go through approval
CREATE POLICY "Users can request to join projects"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
  );

-- Project owners can still add members directly (with any status)
-- The existing "Project owners can add team members" policy already handles this

-- Update the existing update policy to allow owners to change status
-- First drop the old one
DROP POLICY IF EXISTS "Project owners can update team members" ON public.team_members;

-- Recreate with explicit status update support
CREATE POLICY "Project owners can update team members"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND owner_id = auth.uid()
    )
  );
