-- ============================================================
-- Nested AI intros — acceptance proof.  LOCAL SUPABASE ONLY.
-- Seeds auth.users directly (the on-signup trigger creates the profiles),
-- so NEVER run this against prod. Idempotent: re-running re-seeds cleanly.
--
-- Proves the contract of migration 20260907000000_ai_intros.sql:
--   1. `authenticated` cannot call send_intro_message (service role only)
--   2. a good call inserts ONE messages row (origin='intro', intro_note set)
--      and ONE intro_log row, and returns the id
--   3. a retry with the same id is a no-op (still one row, same id)
--   4. a second intro for the same pair (new id) raises PT409
--   5. a blocked pair raises PT403
--   6. get_thread as the receiver returns origin + intro_note, body decrypted
--   7. get_inbox as the receiver is unchanged in shape (six columns, one row)
--   8. the receiver can reply through send_message (a normal human row:
--      origin null), and after that a fresh intro the OTHER way raises PT409
--
-- Run:  supabase start
--       docker exec -i supabase_db_nested psql -U postgres -v ON_ERROR_STOP=1 \
--            < supabase/tests/dm_intro_acceptance.sql
--   Read the NOTICE lines: every test should print PASS.
-- ============================================================

DELETE FROM auth.users WHERE id IN (
  'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
  'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
  'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3'
);
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000','a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1','authenticated','authenticated','intro_a@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2','authenticated','authenticated','intro_b@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3','authenticated','authenticated','intro_c@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '');

-- finished students (username + a photo are required to flip onboarding_completed)
UPDATE public.profiles SET username = 'intro_a', first_name = 'Ada', last_name = 'A', university = 'nyu',
  photos = ARRAY['https://example.test/a.jpg'], onboarding_completed = TRUE
  WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
UPDATE public.profiles SET username = 'intro_b', first_name = 'Bob', last_name = 'B', university = 'nyu',
  photos = ARRAY['https://example.test/b.jpg'], onboarding_completed = TRUE
  WHERE id = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
UPDATE public.profiles SET username = 'intro_c', first_name = 'Cy', last_name = 'C', university = 'nyu',
  photos = ARRAY['https://example.test/c.jpg'], onboarding_completed = TRUE
  WHERE id = 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3';
-- C blocks A
INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES ('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1')
  ON CONFLICT DO NOTHING;

\echo '---- running intro acceptance tests (watch for PASS/FAIL) ----'

-- TEST 1: authenticated cannot execute send_intro_message
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    PERFORM public.send_intro_message('10000000-0000-0000-0000-000000000001',
      'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'hey');
    RAISE NOTICE 'FAIL 1: authenticated could call send_intro_message';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS 1: authenticated cannot call send_intro_message';
  END $$;
ROLLBACK;

-- TEST 2: a good call (as the service side) inserts the intro + the log row
DO $$
DECLARE v_id uuid; n int; nl int; v_origin text; v_note text;
BEGIN
  v_id := public.send_intro_message('10000000-0000-0000-0000-000000000001',
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    'hey Bob, we both do backend', 'You and Ada both do backend.', 'test');
  SELECT count(*), max(origin), max(intro_note) INTO n, v_origin, v_note FROM public.messages WHERE id = '10000000-0000-0000-0000-000000000001';
  SELECT count(*) INTO nl FROM public.intro_log WHERE message_id = '10000000-0000-0000-0000-000000000001';
  IF v_id = '10000000-0000-0000-0000-000000000001' AND n = 1 AND nl = 1 AND v_origin = 'intro' AND v_note = 'You and Ada both do backend.' THEN
    RAISE NOTICE 'PASS 2: intro row + log row written (origin=%, note=%)', v_origin, v_note;
  ELSE
    RAISE NOTICE 'FAIL 2: id=% rows=% log=% origin=% note=%', v_id, n, nl, v_origin, v_note;
  END IF;
END $$;

-- TEST 3: same id again → no-op
DO $$
DECLARE v_id uuid; n int;
BEGIN
  v_id := public.send_intro_message('10000000-0000-0000-0000-000000000001',
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'hey again');
  SELECT count(*) INTO n FROM public.messages WHERE sender_id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  IF v_id = '10000000-0000-0000-0000-000000000001' AND n = 1 THEN RAISE NOTICE 'PASS 3: retry with the same id is a no-op';
  ELSE RAISE NOTICE 'FAIL 3: id=% rows=%', v_id, n; END IF;
END $$;

-- TEST 4: a second intro for the same pair (new id) → PT409
DO $$
BEGIN
  PERFORM public.send_intro_message('10000000-0000-0000-0000-000000000002',
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'hey once more');
  RAISE NOTICE 'FAIL 4: a second intro for the pair was accepted';
EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS 4: second intro for the pair refused (%)', SQLERRM;
END $$;

-- TEST 5: a blocked pair (C blocked A) → PT403
DO $$
BEGIN
  PERFORM public.send_intro_message('10000000-0000-0000-0000-000000000003',
    'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', 'hey Cy');
  RAISE NOTICE 'FAIL 5: intro to a blocking user was accepted';
EXCEPTION WHEN SQLSTATE 'PT403' THEN
  RAISE NOTICE 'PASS 5: blocked pair refused';
END $$;

-- TEST 6: get_thread as the receiver (B) returns origin + intro_note, decrypted body
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text; v_origin text; v_note text; n int;
  BEGIN
    SELECT count(*), max(t.body), max(t.origin), max(t.intro_note) INTO n, v_body, v_origin, v_note
      FROM public.get_thread('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1') t;
    IF n = 1 AND v_body = 'hey Bob, we both do backend' AND v_origin = 'intro' AND v_note = 'You and Ada both do backend.' THEN
      RAISE NOTICE 'PASS 6: get_thread returns origin + intro_note with the decrypted body';
    ELSE
      RAISE NOTICE 'FAIL 6: n=% body=% origin=% note=%', n, v_body, v_origin, v_note;
    END IF;
  END $$;
ROLLBACK;

-- TEST 7: get_inbox as the receiver: shape unchanged (six columns), one row, unread 1
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int; v_unread bigint; v_body text; ncols int;
  BEGIN
    SELECT count(*), max(unread_count), max(last_body) INTO n, v_unread, v_body FROM public.get_inbox();
    SELECT count(*) INTO ncols FROM information_schema.routines r
      JOIN information_schema.parameters p ON p.specific_name = r.specific_name
      WHERE r.routine_schema = 'public' AND r.routine_name = 'get_inbox' AND p.parameter_mode = 'OUT';
    IF n = 1 AND v_unread = 1 AND v_body = 'hey Bob, we both do backend' AND ncols = 6 THEN
      RAISE NOTICE 'PASS 7: get_inbox unchanged (six columns), one unread row';
    ELSE
      RAISE NOTICE 'FAIL 7: n=% unread=% body=% cols=%', n, v_unread, v_body, ncols;
    END IF;
  END $$;
ROLLBACK;

-- TEST 8: B replies through send_message (origin null); then an intro B→A is refused (PT409)
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_origin text;
  BEGIN
    PERFORM public.send_message('10000000-0000-0000-0000-000000000009', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'hey Ada, yes!');
    SELECT origin INTO v_origin FROM public.messages WHERE id = '10000000-0000-0000-0000-000000000009';
    IF v_origin IS NULL THEN RAISE NOTICE 'PASS 8a: the reply is a normal row (origin null)';
    ELSE RAISE NOTICE 'FAIL 8a: reply origin=%', v_origin; END IF;
  END $$;
COMMIT;
DO $$
BEGIN
  PERFORM public.send_intro_message('10000000-0000-0000-0000-000000000004',
    'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'hey Ada');
  RAISE NOTICE 'FAIL 8b: intro accepted for a pair with history';
EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS 8b: intro refused for a pair with history (%)', SQLERRM;
END $$;

\echo '---- done ----'
