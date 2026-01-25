-- Fix storage bucket and policies for avatar uploads

-- First, make sure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;

-- Create simpler policies that work
CREATE POLICY "Avatar upload policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatar update policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Avatar delete policy"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Avatar public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
