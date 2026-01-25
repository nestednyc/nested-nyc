-- Nested NYC Row Level Security Policies
-- Run this AFTER 001_schema.sql in Supabase SQL Editor

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nest_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Read: All authenticated users can view profiles
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Users can only insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Update: Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PROJECTS POLICIES
-- ============================================

-- Read: Published projects OR own projects
CREATE POLICY "Projects viewable if published or owned"
  ON public.projects FOR SELECT
  TO authenticated
  USING (publish_to_discover = TRUE OR owner_id = auth.uid());

-- Insert: Users can create projects they own
CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Update: Only owner can update
CREATE POLICY "Owners can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Delete: Only owner can delete
CREATE POLICY "Owners can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================
-- TEAM MEMBERS POLICIES
-- ============================================

-- Read: Viewable if project is visible (published or owned)
CREATE POLICY "Team members viewable with project"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND (publish_to_discover = TRUE OR owner_id = auth.uid())
    )
  );

-- Insert: Project owners can add team members
CREATE POLICY "Project owners can add team members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND owner_id = auth.uid()
    )
  );

-- Update: Project owners can update team members
CREATE POLICY "Project owners can update team members"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND owner_id = auth.uid()
    )
  );

-- Delete: Project owners can remove team members
CREATE POLICY "Project owners can remove team members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND owner_id = auth.uid()
    )
  );

-- ============================================
-- NESTS POLICIES
-- ============================================

-- Read: All nests viewable by authenticated users
CREATE POLICY "Nests viewable by authenticated"
  ON public.nests FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Users can create nests
CREATE POLICY "Users can create nests"
  ON public.nests FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Update: Only owner can update nest
CREATE POLICY "Owners can update nests"
  ON public.nests FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Delete: Only owner can delete nest
CREATE POLICY "Owners can delete nests"
  ON public.nests FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================
-- NEST MEMBERS POLICIES
-- ============================================

-- Read: All nest members viewable
CREATE POLICY "Nest members viewable"
  ON public.nest_members FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Users can join nests (add themselves)
CREATE POLICY "Users can join nests"
  ON public.nest_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Delete: Users can leave nests OR owners can remove members
CREATE POLICY "Users can leave or owners remove"
  ON public.nest_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.nests
      WHERE id = nest_id
      AND owner_id = auth.uid()
    )
  );

-- ============================================
-- EVENTS POLICIES
-- ============================================

-- Read: All events viewable by authenticated users
CREATE POLICY "Events viewable by authenticated"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Users can create events
CREATE POLICY "Users can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (organizer_id = auth.uid());

-- Update: Only organizer can update event
CREATE POLICY "Organizers can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

-- Delete: Only organizer can delete event
CREATE POLICY "Organizers can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (organizer_id = auth.uid());

-- ============================================
-- EVENT REGISTRATIONS POLICIES
-- ============================================

-- Read: All registrations viewable
CREATE POLICY "Event registrations viewable"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (true);

-- Insert: Users can register for events (themselves only)
CREATE POLICY "Users can register for events"
  ON public.event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Delete: Users can unregister from events OR organizers can remove
CREATE POLICY "Users can unregister or organizers remove"
  ON public.event_registrations FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id
      AND organizer_id = auth.uid()
    )
  );
