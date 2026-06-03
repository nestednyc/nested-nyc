-- Pre-prod security hardening. Closes four go-live blockers that the
-- earlier debug/public-browse migrations had opened up:
--   (1) .edu enforced at the DB in handle_new_user (org_admin accounts exempt).
--   (2) storage writes scoped to the uploader's ${auth.uid()}/ folder —
--       006_debug_storage had left every bucket world-writable for any
--       authenticated user.
--   (3) organizations INSERT requires owner_user_id = auth.uid() AND
--       verified = false — the original policy was WITH CHECK (true), so
--       anyone could mint a pre-"verified" org.
--   (4) event_registrations SELECT restricted to authenticated —
--       public_browse had opened it to anon, leaking the RSVP graph.
--
-- All statements are idempotent (DROP IF EXISTS / CREATE OR REPLACE) so the
-- migration is safe to replay.

-- ============================================
-- (1) .edu enforcement in the signup trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct TEXT := COALESCE(NEW.raw_user_meta_data->>'account_type', 'student');
BEGIN
  IF acct <> 'org_admin' AND lower(COALESCE(NEW.email, '')) NOT LIKE '%.edu' THEN
    RAISE EXCEPTION 'Only .edu email addresses may register'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, account_type)
  VALUES (NEW.id, acct)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================
-- (2) storage: replace the world-writable allow_all_* write policies
--     (from 006_debug_storage) with uid-folder-scoped ones.
--     Public read (allow_all_select) is intentional and left in place.
-- ============================================
DROP POLICY IF EXISTS "allow_all_insert" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_update" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_delete" ON storage.objects;

DROP POLICY IF EXISTS "Users manage own folder (insert)" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own folder (update)" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own folder (delete)" ON storage.objects;

CREATE POLICY "Users manage own folder (insert)"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['avatars', 'project-icons'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users manage own folder (update)"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['avatars', 'project-icons'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['avatars', 'project-icons'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users manage own folder (delete)"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['avatars', 'project-icons'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- (3) organizations INSERT: owner-only, must start unverified.
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users create orgs they own (unverified)" ON public.organizations;

CREATE POLICY "Users create orgs they own (unverified)"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND verified = false);

-- ============================================
-- (4) event_registrations SELECT: authenticated-only (no anon RSVP-graph read).
-- ============================================
DROP POLICY IF EXISTS "Event registrations viewable by anyone" ON public.event_registrations;
DROP POLICY IF EXISTS "Event registrations viewable when signed in" ON public.event_registrations;

CREATE POLICY "Event registrations viewable when signed in"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
