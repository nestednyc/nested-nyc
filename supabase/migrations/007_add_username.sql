-- Migration: Add username column to profiles
-- Purpose: Enable unique usernames for user identification

-- Add username column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index for case-insensitive username lookup
-- This prevents users from registering "JohnDoe" if "johndoe" exists
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
ON public.profiles (LOWER(username));

-- Add check constraint for username format:
-- - 3-30 characters
-- - Only alphanumeric and underscores
-- - Must start with a letter
ALTER TABLE public.profiles
ADD CONSTRAINT username_format_check
CHECK (
  username IS NULL OR (
    LENGTH(username) >= 3 AND
    LENGTH(username) <= 30 AND
    username ~ '^[a-zA-Z][a-zA-Z0-9_]*$'
  )
);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.username IS 'Unique username for the user (3-30 chars, alphanumeric + underscore, starts with letter)';
