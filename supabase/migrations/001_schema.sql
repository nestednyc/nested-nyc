-- Nested NYC Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID extension (using pgcrypto for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  university TEXT,
  major TEXT,
  bio TEXT,
  fields TEXT[] DEFAULT '{}',
  looking_for TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  avatar TEXT,
  links JSONB DEFAULT '{"github": "", "portfolio": "", "linkedin": "", "discord": ""}',
  projects JSONB DEFAULT '[]',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for university filtering
CREATE INDEX idx_profiles_university ON public.profiles(university);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  category TEXT CHECK (category IN ('startup', 'class-project', 'side-project', 'research')),
  image TEXT,
  university TEXT,
  author_name TEXT,
  author_image TEXT,
  roles TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  commitment TEXT,
  publish_to_discover BOOLEAN DEFAULT TRUE,
  spots_left INTEGER DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for projects
CREATE INDEX idx_projects_owner ON public.projects(owner_id);
CREATE INDEX idx_projects_published ON public.projects(publish_to_discover) WHERE publish_to_discover = TRUE;
CREATE INDEX idx_projects_category ON public.projects(category);

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  school TEXT,
  role TEXT,
  image TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_members_project ON public.team_members(project_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

-- ============================================
-- NESTS TABLE
-- ============================================
CREATE TABLE public.nests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  tags TEXT[] DEFAULT '{}',
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nests_owner ON public.nests(owner_id);

-- ============================================
-- NEST MEMBERS TABLE
-- ============================================
CREATE TABLE public.nest_members (
  nest_id UUID NOT NULL REFERENCES public.nests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (nest_id, user_id)
);

CREATE INDEX idx_nest_members_user ON public.nest_members(user_id);

-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  time TEXT,
  location TEXT,
  address TEXT,
  image TEXT,
  attendees INTEGER DEFAULT 0,
  max_attendees INTEGER,
  tags TEXT[] DEFAULT '{}',
  highlights TEXT[] DEFAULT '{}',
  organizer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organizer_name TEXT,
  organizer_image TEXT,
  is_past BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_events_organizer ON public.events(organizer_id);

-- ============================================
-- EVENT REGISTRATIONS TABLE
-- ============================================
CREATE TABLE public.event_registrations (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_event_registrations_user ON public.event_registrations(user_id);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER nests_updated_at
  BEFORE UPDATE ON public.nests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update nest member count
CREATE OR REPLACE FUNCTION update_nest_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.nests SET member_count = member_count + 1 WHERE id = NEW.nest_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.nests SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.nest_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_nest_member_change
  AFTER INSERT OR DELETE ON public.nest_members
  FOR EACH ROW EXECUTE FUNCTION update_nest_member_count();

-- Auto-update event attendee count
CREATE OR REPLACE FUNCTION update_event_attendee_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET attendees = attendees + 1 WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET attendees = GREATEST(attendees - 1, 0) WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_event_registration_change
  AFTER INSERT OR DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_event_attendee_count();
