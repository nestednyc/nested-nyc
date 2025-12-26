-- Migration: Enforce .edu Email Validation at Database Level
-- This ensures that only .edu email addresses can be used for signup
-- even if frontend validation is bypassed

-- Step 1: Create a function to validate .edu email addresses
CREATE OR REPLACE FUNCTION public.is_edu_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if email is valid format
  IF email IS NULL OR email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN FALSE;
  END IF;
  
  -- Extract domain
  DECLARE
    domain TEXT;
  BEGIN
    domain := LOWER(SPLIT_PART(email, '@', 2));
    
    -- Check for .edu domain (US universities)
    IF domain LIKE '%.edu' THEN
      RETURN TRUE;
    END IF;
    
    -- Check for international university domains
    IF domain LIKE '%.ac.uk' OR      -- UK universities
       domain LIKE '%.edu.au' OR     -- Australian universities
       domain LIKE '%.edu.ca' OR     -- Canadian universities
       domain LIKE '%.ac.za' OR      -- South African universities
       domain LIKE '%.edu.sg' OR     -- Singapore universities
       domain LIKE '%.ac.jp' OR      -- Japanese universities
       domain LIKE '%.edu.cn' THEN   -- Chinese universities
      RETURN TRUE;
    END IF;
    
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create a function that will be called by auth hook
-- This function validates the email before user creation
CREATE OR REPLACE FUNCTION public.validate_edu_email_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate email domain
  IF NOT public.is_edu_email(NEW.email) THEN
    RAISE EXCEPTION 'Only .edu email addresses are allowed. Please use your university email address.'
      USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_edu_email(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_edu_email_on_signup() TO authenticated, anon;

-- Note: Direct triggers on auth.users require special permissions.
-- The following approach uses Supabase's auth hooks via Edge Functions instead.
-- See the Edge Function implementation below.

