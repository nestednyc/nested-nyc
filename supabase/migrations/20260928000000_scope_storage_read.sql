-- ============================================================
-- Scope Storage public read to the genuinely public buckets.
-- ------------------------------------------------------------
-- 006_debug_storage dropped every storage.objects policy and created
-- `allow_all_select` = FOR SELECT TO public USING (true); 20260602000003
-- deliberately kept it ("Public read … is intentional") when the only buckets
-- were public (avatars, project-icons). 20260625000000 then added the PRIVATE
-- `dm-attachments` bucket with a participant-only read policy — but Postgres
-- ORs permissive policies, and that participant policy is scoped TO
-- authenticated, so for the `anon` role the surviving blanket `allow_all_select`
-- was the only SELECT policy and it covered EVERY bucket, dm-attachments
-- included. Result (confirmed live 2026-09-28): anyone with the shipped anon key
-- could list + download private DM attachments.
--
-- Fix: replace the blanket read with one scoped to the three public buckets.
-- dm-attachments then falls back to its own participant-only policy
-- ("DM attach: participant read", 20260625000000), and participants still render
-- attachments via 1-hour signed URLs (createSignedUrl runs under that policy).
--
-- Idempotent (DROP … IF EXISTS / CREATE): safe to replay locally and against
-- prod even where policy state has drifted.
-- ============================================================

DROP POLICY IF EXISTS "allow_all_select" ON storage.objects;
-- Legacy names 006's reset loop already removed in prod; re-dropped so a clean
-- local replay from 004/005 converges to the same state.
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;

DROP POLICY IF EXISTS "Public read of public buckets" ON storage.objects;
CREATE POLICY "Public read of public buckets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = ANY (ARRAY['avatars', 'project-icons', 'post-images']));

NOTIFY pgrst, 'reload schema';
