-- Migration: Create lookup functions for email and username validation
-- Purpose: Allow checking if email/username exists before signup

-- Function to check if email already exists in auth.users
-- Uses SECURITY DEFINER to access auth.users (which RLS normally blocks)
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normalize email to lowercase for comparison
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE LOWER(email) = LOWER(email_to_check)
  );
END;
$$;

-- Function to check if username is available
-- Returns TRUE if username is available (not taken), FALSE if taken
CREATE OR REPLACE FUNCTION public.check_username_available(username_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if username is null or empty
  IF username_to_check IS NULL OR TRIM(username_to_check) = '' THEN
    RETURN FALSE;
  END IF;

  -- Normalize to lowercase for case-insensitive check
  -- Return TRUE if NOT exists (available), FALSE if exists (taken)
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE LOWER(username) = LOWER(username_to_check)
  );
END;
$$;

-- Grant execute permissions to anon and authenticated roles
-- anon: for pre-signup checks
-- authenticated: for profile updates
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.check_email_exists(TEXT) IS 'Check if an email is already registered (for signup validation)';
COMMENT ON FUNCTION public.check_username_available(TEXT) IS 'Check if a username is available (returns TRUE if available)';
