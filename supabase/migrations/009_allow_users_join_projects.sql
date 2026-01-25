-- Allow users to join projects (add themselves as team members)
-- This complements the existing "Project owners can add team members" policy
CREATE POLICY "Users can join projects"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to leave projects (remove themselves)
CREATE POLICY "Users can leave projects"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
