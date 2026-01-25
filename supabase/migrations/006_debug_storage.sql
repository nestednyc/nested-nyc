-- Completely reset storage policies for avatars bucket

-- Make sure bucket exists and is public
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

-- Remove ALL policies on storage.objects that mention avatars
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'objects'
        AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Create very permissive policies for avatars bucket
CREATE POLICY "allow_all_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "allow_all_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "allow_all_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "allow_all_select"
ON storage.objects FOR SELECT
TO public
USING (true);
