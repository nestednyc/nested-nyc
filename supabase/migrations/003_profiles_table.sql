-- Migration: Profiles Table with Username System
-- Instagram-style unique usernames with DB-backed onboarding state
-- Username is picked LAST in onboarding to reduce zombie profiles

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Username fields (nullable until /username step)
  username TEXT,
  username_lower TEXT GENERATED ALWAYS AS (LOWER(username)) STORED,
  
  -- Basic profile info
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  
  -- Academic info
  university TEXT,
  major TEXT,
  graduation_year INTEGER,
  
  -- Project preferences (from onboarding)
  looking_for TEXT[],           -- e.g., ['co-founder', 'teammates', 'mentors']
  role_preference TEXT,          -- e.g., 'builder', 'designer', 'both'
  skills TEXT[],                 -- e.g., ['React', 'Python', 'Design']
  
  -- Profile content
  bio TEXT,
  
  -- Flexible metadata for future fields
  metadata JSONB DEFAULT '{}',
  
  -- Onboarding state
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Case-insensitive unique username index
-- Only non-NULL usernames are reserved (allows multiple NULLs)
CREATE UNIQUE INDEX idx_profiles_username_lower
  ON profiles (username_lower)
  WHERE username_lower IS NOT NULL;

-- Fast lookup by username
CREATE INDEX idx_profiles_username_search
  ON profiles (username_lower)
  WHERE username_lower IS NOT NULL;

-- Find users by university for discovery
CREATE INDEX idx_profiles_university
  ON profiles (university)
  WHERE university IS NOT NULL;

-- Find incomplete profiles for cleanup
CREATE INDEX idx_profiles_incomplete
  ON profiles (created_at)
  WHERE onboarding_completed = FALSE;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view all profiles (for discovery)
CREATE POLICY "Profiles are publicly viewable"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to check username availability
CREATE POLICY "Allow anon to check usernames"
  ON profiles
  FOR SELECT
  TO anon
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================
-- RPC: CHECK USERNAME AVAILABILITY
-- ============================================
-- Returns true if username is available (case-insensitive)
-- Short-circuit: don't call this if format is invalid on client
CREATE OR REPLACE FUNCTION is_username_available(check_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Empty or NULL check
  IF check_username IS NULL OR TRIM(check_username) = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if username exists (case-insensitive)
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE username_lower = LOWER(TRIM(check_username))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION is_username_available(TEXT) TO authenticated, anon;

-- ============================================
-- RPC: GET EMAIL BY USERNAME (for login)
-- ============================================
-- SECURITY DEFINER: Returns only the email, nothing else
-- Used by signInWithIdentifier to resolve username → email
CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Validate input
  IF p_username IS NULL OR TRIM(p_username) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Look up the profile by username (case-insensitive)
  SELECT u.email INTO user_email
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE p.username_lower = LOWER(TRIM(p_username));
  
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon (needed for login flow)
GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated;

-- ============================================
-- RPC: GET PROFILE BY USER ID
-- ============================================
CREATE OR REPLACE FUNCTION get_profile(user_id UUID)
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_profile(UUID) TO authenticated;

-- ============================================
-- CLEANUP FUNCTION FOR ZOMBIE PROFILES
-- ============================================
-- Profiles that never completed onboarding after X days
-- Username is only set at the end, so incomplete profiles
-- won't have usernames reserved anyway
CREATE OR REPLACE FUNCTION cleanup_abandoned_profiles(days_threshold INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM profiles
  WHERE onboarding_completed = FALSE
    AND created_at < NOW() - (days_threshold || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service role should run cleanup
GRANT EXECUTE ON FUNCTION cleanup_abandoned_profiles(INTEGER) TO service_role;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE profiles IS 'User profiles with Instagram-style unique usernames';
COMMENT ON COLUMN profiles.username IS 'Unique username, set at end of onboarding flow';
COMMENT ON COLUMN profiles.username_lower IS 'Auto-generated lowercase version for case-insensitive lookups';
COMMENT ON COLUMN profiles.onboarding_completed IS 'True when user finishes all onboarding steps';
COMMENT ON FUNCTION is_username_available IS 'Check if a username is available (case-insensitive)';
COMMENT ON FUNCTION get_email_by_username IS 'Resolve username to email for login (SECURITY DEFINER)';
COMMENT ON FUNCTION cleanup_abandoned_profiles IS 'Remove profiles that never completed onboarding';
