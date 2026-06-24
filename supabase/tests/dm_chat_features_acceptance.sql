-- ============================================================
-- DM chat features acceptance proof — message length cap + attachments.
-- LOCAL SUPABASE ONLY. Seeds auth.users directly; NEVER run against prod.
-- Idempotent: re-running re-seeds cleanly.
--
-- Proves:
--   1. Body length cap — a body over 4000 chars is rejected (PT422).
--   2. Empty + no attachment is rejected (PT422); an attachment-only message
--      (empty body + a file) is allowed.
--   3. send_message persists attachment rows and returns them; get_thread
--      surfaces them as a jsonb array.
--   4. get_inbox.last_has_attachment reflects the latest message.
--   5. >5 attachments rejected (PT422).
--   6. Deleting a message cascades its attachment rows away.
--
-- Run:  docker exec -i supabase_db_nested-nyc psql -U postgres -v ON_ERROR_STOP=1 \
--          < supabase/tests/dm_chat_features_acceptance.sql
-- Depends on: 20260621..20260625 (esp. 20260625000000_dm_chat_features.sql).
-- Fixtures: A (aaaa…) connected to B (bbbb…).
-- ============================================================

DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','dmcf_a@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','dmcf_b@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '');
INSERT INTO public.connections (user_id, target_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT DO NOTHING;

\echo '---- running DM chat-features acceptance tests (watch for PASS/FAIL) ----'

-- ============================================================
-- TEST 1: a body over 4000 chars is rejected (PT422 / message_too_long).
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    PERFORM public.send_message('90000000-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', repeat('x', 4001));
    RAISE NOTICE 'TEST 1 FAIL: a 4001-char body was ALLOWED';
  EXCEPTION
    WHEN sqlstate 'PT422' THEN RAISE NOTICE 'TEST 1 PASS: over-length body rejected (PT422)';
    WHEN others THEN RAISE NOTICE 'TEST 1 FAIL: expected PT422, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 2: empty body with NO attachment is rejected; attachment-only is allowed.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    PERFORM public.send_message('90000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '');
    RAISE NOTICE 'TEST 2a FAIL: empty send with no attachment was ALLOWED';
  EXCEPTION
    WHEN sqlstate 'PT422' THEN RAISE NOTICE 'TEST 2a PASS: empty + no attachment rejected (PT422)';
    WHEN others THEN RAISE NOTICE 'TEST 2a FAIL: expected PT422, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.send_message(
      '90000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '',
      '[{"storage_path":"a/m/pic.png","mime_type":"image/png","size_bytes":100,"file_name":"pic.png"}]'::jsonb);
    IF n = 1 THEN RAISE NOTICE 'TEST 2b PASS: attachment-only message (empty body + file) allowed';
    ELSE RAISE NOTICE 'TEST 2b FAIL: rows=% (expected 1)', n;
    END IF;
  EXCEPTION WHEN others THEN RAISE NOTICE 'TEST 2b FAIL: attachment-only send errored SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 3: send_message persists + returns attachments; get_thread surfaces them.
-- (COMMIT so get_thread in the next txn sees the row.)
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_att jsonb;
  BEGIN
    SELECT m.attachments INTO v_att FROM public.send_message(
      '90000000-0000-0000-0000-000000000010','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'here are two files',
      '[{"storage_path":"a/m/one.png","mime_type":"image/png","size_bytes":11,"file_name":"one.png"},
        {"storage_path":"a/m/two.pdf","mime_type":"application/pdf","size_bytes":22,"file_name":"two.pdf"}]'::jsonb) AS m;
    IF jsonb_array_length(v_att) = 2 AND (v_att->0->>'file_name') = 'one.png'
    THEN RAISE NOTICE 'TEST 3a PASS: send_message returned 2 attachments in order (first=one.png)';
    ELSE RAISE NOTICE 'TEST 3a FAIL: attachments=%', v_att;
    END IF;
  END $$;
COMMIT;

DO $$
DECLARE n_rows int;
BEGIN
  SELECT count(*) INTO n_rows FROM public.message_attachments WHERE message_id = '90000000-0000-0000-0000-000000000010';
  IF n_rows = 2 THEN RAISE NOTICE 'TEST 3b PASS: 2 message_attachments rows persisted';
  ELSE RAISE NOTICE 'TEST 3b FAIL: persisted rows=% (expected 2)', n_rows;
  END IF;
END $$;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_att jsonb;
  BEGIN
    SELECT t.attachments INTO v_att FROM public.get_thread('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') AS t
      WHERE t.id = '90000000-0000-0000-0000-000000000010';
    IF jsonb_array_length(v_att) = 2 AND (v_att->1->>'mime_type') = 'application/pdf'
    THEN RAISE NOTICE 'TEST 3c PASS: get_thread surfaces the attachments to the recipient (2; second is the pdf)';
    ELSE RAISE NOTICE 'TEST 3c FAIL: get_thread attachments=%', v_att;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 4: get_inbox.last_has_attachment is true when the latest message has one.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_flag boolean;
  BEGIN
    SELECT i.last_has_attachment INTO v_flag FROM public.get_inbox() AS i
      WHERE i.peer_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    IF v_flag THEN RAISE NOTICE 'TEST 4 PASS: get_inbox reports last_has_attachment = true for the A↔B thread';
    ELSE RAISE NOTICE 'TEST 4 FAIL: last_has_attachment = % (expected true)', v_flag;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 5: more than 5 attachments is rejected (PT422 / too_many_attachments).
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_many jsonb;
  BEGIN
    SELECT jsonb_agg(jsonb_build_object('storage_path','a/m/f'||g,'mime_type','image/png','size_bytes',1,'file_name','f'||g||'.png'))
      INTO v_many FROM generate_series(1,6) AS g;
    PERFORM public.send_message('90000000-0000-0000-0000-000000000020','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'too many', v_many);
    RAISE NOTICE 'TEST 5 FAIL: 6 attachments were ALLOWED';
  EXCEPTION
    WHEN sqlstate 'PT422' THEN RAISE NOTICE 'TEST 5 PASS: >5 attachments rejected (PT422)';
    WHEN others THEN RAISE NOTICE 'TEST 5 FAIL: expected PT422, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 6: deleting a message cascades its attachment rows away.
-- (Message 90..10 from TEST 3 is committed with 2 attachments.)
-- ============================================================
DELETE FROM public.messages WHERE id = '90000000-0000-0000-0000-000000000010';
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.message_attachments WHERE message_id = '90000000-0000-0000-0000-000000000010';
  IF n = 0 THEN RAISE NOTICE 'TEST 6 PASS: deleting the message cascaded its attachment rows away (0 left)';
  ELSE RAISE NOTICE 'TEST 6 FAIL: % attachment rows survived the message delete', n;
  END IF;
END $$;

-- ---------- cleanup ----------
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

\echo '---- done. all lines above should read PASS ----'
