-- ============================================================
-- DM Sprint 2 — RPC seam acceptance proof.  LOCAL SUPABASE ONLY.
-- Seeds auth.users directly (the on-signup trigger then creates profiles),
-- so NEVER run this against prod. Idempotent: re-running re-seeds cleanly.
--
-- Exercises the six S2 SECURITY DEFINER RPCs end-to-end through the
-- `authenticated` role (impersonation via request.jwt.claims, exactly as a
-- PostgREST call arrives), proving: the connection gate, the block gate,
-- caller-scoped idempotency (incl. the cross-user leak regression),
-- the 10-per-10s rate limit, inbox/thread reads, read-clearing, the
-- block/unblock round-trip, and the REVOKE INSERT write-path lock.
--
-- Run:  supabase start
--       psql "$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL=//p' | tr -d '\"')" \
--            -f supabase/tests/dm_s2_acceptance.sql
--   (or:  docker exec -i supabase_db_nested psql -U postgres -v ON_ERROR_STOP=1 \
--            < supabase/tests/dm_s2_acceptance.sql)
--   (or paste into Studio's SQL editor). Read the NOTICE lines: every test
--   should print PASS. Any FAIL (or an uncaught ERROR) means the contract is wrong.
--
-- Depends on: migration 20260622000000_dm_rpcs.sql (the six RPCs + REVOKE INSERT)
--             applied on top of 20260621000000_add_messages_and_blocks.sql (S1).
--
-- Fixtures:  A — connected to B AND to C   (aaaaaaaa…)
--            B — connected to A             (bbbbbbbb…)
--            C — connected to A only        (cccccccc…)
--   (A↔C exists so test 5 can reach send_message's INSERT and prove the PK
--    conflict — i.e. that idempotency did NOT return C's foreign row to A;
--    every OTHER C-vs-A "unconnected" case below messages B, to whom C is not
--    connected. See the per-test notes.)
-- ============================================================

-- ---------- CLEAN SLATE (cascades: auth.users → profiles → messages/blocks/connections) ----------
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- ---------- SEED USERS (trigger handle_new_user auto-creates the profiles rows; .edu required) ----------
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','dm_a@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','dm_b@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-cccccccccccc','authenticated','authenticated','dm_c@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '');

-- Connections (directed; the gate accepts either direction):
--   A → B  (the primary connected pair)
--   A → C  (lets test 5 reach the INSERT/PK-conflict path; A↔C is otherwise unused)
-- NOTE: C is deliberately NOT connected to B, so "C → B" is the unconnected case.
INSERT INTO public.connections (user_id, target_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc')
ON CONFLICT DO NOTHING;

\echo '---- running S2 acceptance tests (watch for PASS/FAIL) ----'

-- ============================================================
-- TEST 1: send_message succeeds for a connected sender (A→B) and the body round-trips.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE
    v_id       uuid;
    v_sender   uuid;
    v_recip    uuid;
    v_body     text;
    n          int;
  BEGIN
    SELECT m.id, m.sender_id, m.recipient_id, m.body
      INTO v_id, v_sender, v_recip, v_body
      FROM public.send_message(
             '11111111-0000-0000-0000-000000000001',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'hello B, this is A') AS m;

    SELECT count(*) INTO n FROM public.messages
      WHERE id = '11111111-0000-0000-0000-000000000001';

    IF v_body = 'hello B, this is A'
       AND v_sender = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       AND v_recip  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       AND v_id     = '11111111-0000-0000-0000-000000000001'
       AND n = 1
    THEN RAISE NOTICE 'TEST 1 PASS: A→B send succeeded; body round-tripped, sender stamped, 1 row written';
    ELSE RAISE NOTICE 'TEST 1 FAIL: body=%, sender=%, recip=%, id=%, rows=%', v_body, v_sender, v_recip, v_id, n;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 2: an unconnected send (C → B) is rejected with PT403 / not_connected.
-- (C is connected only to A, never to B — so this is the pure not-connected gate.)
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '22222222-0000-0000-0000-000000000002',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'C trying to reach B') AS m;
    RAISE NOTICE 'TEST 2 FAIL: unconnected send was ALLOWED (got body=%)', v_body;
  EXCEPTION
    WHEN sqlstate 'PT403' THEN
      RAISE NOTICE 'TEST 2 PASS: unconnected send rejected (PT403 / not_connected)';
    WHEN others THEN
      RAISE NOTICE 'TEST 2 FAIL: expected PT403, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 3: a CONNECTED but BLOCKED send is rejected with PT403 / blocked.
-- 3a: B blocks A via block_user (must COMMIT so the next transaction sees it).
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  SELECT public.block_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');  -- top-level SQL: SELECT, not PERFORM (plpgsql-only)
COMMIT;

-- 3b: as A — still connected to B, but B has blocked A, so the send must fail.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '33333333-0000-0000-0000-000000000003',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'A to B after being blocked') AS m;
    RAISE NOTICE 'TEST 3 FAIL: blocked send was ALLOWED (got body=%)', v_body;
  EXCEPTION
    WHEN sqlstate 'PT403' THEN
      RAISE NOTICE 'TEST 3 PASS: blocked send rejected (PT403 / blocked) though A↔B still connected';
    WHEN others THEN
      RAISE NOTICE 'TEST 3 FAIL: expected PT403, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- restore baseline: remove B's block of A so later tests run on a clean graph
DELETE FROM public.blocks
  WHERE blocker_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND blocked_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ============================================================
-- TEST 4: idempotency — re-calling send_message with the SAME p_id does NOT
-- create a second row (count stays 1) and returns the ORIGINAL body.
-- Both calls share one transaction so the first row is visible to the second.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE
    v_body1 text;
    v_body2 text;
    n       int;
  BEGIN
    SELECT m.body INTO v_body1 FROM public.send_message(
             '44444444-0000-0000-0000-000000000004',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'first body') AS m;

    -- same id, DIFFERENT body text: must return the FIRST body, not the new one.
    SELECT m.body INTO v_body2 FROM public.send_message(
             '44444444-0000-0000-0000-000000000004',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'second body (should be ignored)') AS m;

    SELECT count(*) INTO n FROM public.messages
      WHERE id = '44444444-0000-0000-0000-000000000004';

    IF n = 1 AND v_body1 = 'first body' AND v_body2 = 'first body'
    THEN RAISE NOTICE 'TEST 4 PASS: duplicate p_id is idempotent (1 row; both calls return original body)';
    ELSE RAISE NOTICE 'TEST 4 FAIL: rows=% body1=% body2=% (expected 1 / first body / first body)', n, v_body1, v_body2;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 5: idempotency-leak REGRESSION (caller-scoped lookup).
-- A pre-existing message between OTHER users (B→C) is seeded as postgres. Caller A
-- then calls send_message with THAT id. Because the idempotency lookup is
-- `WHERE id = p_id AND sender_id = auth.uid()`, A's lookup finds nothing, falls
-- through to the gate (A↔C IS connected, so the gate passes) and INSERT, which
-- fails on the PK. A must therefore NEVER receive B/C's foreign body — it must error.
-- (A unscoped `WHERE id = p_id` lookup would hand A the B→C row → leak. This test
-- catches that regression.)
-- ============================================================
-- 5a: seed the foreign B→C row as the script runner (postgres bypasses RLS/REVOKE).
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc) VALUES
  ('55555555-0000-0000-0000-000000000005',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   extensions.pgp_sym_encrypt('SECRET B→C body — A must never see this', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')))
ON CONFLICT (id) DO NOTHING;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    -- A sends to C (A↔C connected) reusing the B→C id. The id collides on PK only
    -- AFTER the caller-scoped idempotency lookup misses, so this must raise — and
    -- critically must NOT return the foreign body.
    SELECT m.body INTO v_body FROM public.send_message(
             '55555555-0000-0000-0000-000000000005',
             'cccccccc-cccc-cccc-cccc-cccccccccccc',
             'A reusing a foreign id') AS m;
    -- If we got here, the call returned a row instead of erroring — leak iff it's B's body.
    IF v_body = 'SECRET B→C body — A must never see this'
    THEN RAISE NOTICE 'TEST 5 FAIL: LEAK — A received B→C''s foreign body via unscoped idempotency lookup';
    ELSE RAISE NOTICE 'TEST 5 FAIL: A''s reused-id send unexpectedly succeeded (body=%)', v_body;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'TEST 5 PASS: caller-scoped lookup missed the foreign id; fell through to PK conflict (no leak)';
    WHEN others THEN
      -- Any error (not a returned foreign row) also proves A did not receive B/C's body.
      RAISE NOTICE 'TEST 5 PASS (via %): A errored instead of receiving the foreign body (%) — no leak', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- belt-and-suspenders: the foreign row is still B→C and untouched (A's attempt rolled back).
DO $$
DECLARE v_sender uuid; v_recip uuid;
BEGIN
  SELECT sender_id, recipient_id INTO v_sender, v_recip
    FROM public.messages WHERE id='55555555-0000-0000-0000-000000000005';
  IF v_sender='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND v_recip='cccccccc-cccc-cccc-cccc-cccccccccccc'
  THEN RAISE NOTICE 'TEST 5b PASS: the foreign B→C row is intact (A''s reuse attempt did not overwrite it)';
  ELSE RAISE NOTICE 'TEST 5b FAIL: foreign row mutated — sender=% recip=%', v_sender, v_recip;
  END IF;
END $$;

-- test 5's foreign B→C fixture has served its purpose; remove it (by exact id) so it
-- doesn't surface in C's own legitimate C↔B thread during test 8b.
DELETE FROM public.messages WHERE id = '55555555-0000-0000-0000-000000000005';

-- ============================================================
-- TEST 6: rate-limit (10 per 10 seconds).
-- 6a: seed 10 A→B messages within the last 10s as postgres (fixtures, not via the RPC),
--     then A's 11th send via send_message must be rejected with PT429.
-- ============================================================
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc, created_at)
SELECT
  ('66666666-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  extensions.pgp_sym_encrypt('rate fixture ' || g, (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')),
  now() - (g * interval '50 milliseconds')   -- all comfortably inside the 10s window
FROM generate_series(1, 10) AS g
ON CONFLICT (id) DO NOTHING;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '66666666-1111-1111-1111-111111111111',  -- a fresh id (not idempotent)
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'the 11th message — over the limit') AS m;
    RAISE NOTICE 'TEST 6a FAIL: 11th send was ALLOWED despite 10 in the window (got body=%)', v_body;
  EXCEPTION
    WHEN sqlstate 'PT429' THEN
      RAISE NOTICE 'TEST 6a PASS: 11th send within 10s rejected (PT429 / rate_limited)';
    WHEN others THEN
      RAISE NOTICE 'TEST 6a FAIL: expected PT429, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- 6b: an idempotent RETRY of an already-stored id must return early — BEFORE the rate
--     check — so it is NOT blocked even though A is over the limit. Reuse one of the
--     10 fixture ids (it exists and was sent by A).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '66666666-0000-0000-0000-000000000001',  -- == fixture g=1, A→B, already stored
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'retry body (ignored)') AS m;
    IF v_body = 'rate fixture 1'
    THEN RAISE NOTICE 'TEST 6b PASS: idempotent retry of an existing id returns early (not rate-limited), original body returned';
    ELSE RAISE NOTICE 'TEST 6b FAIL: retry returned body=% (expected the original ''rate fixture 1'')', v_body;
    END IF;
  EXCEPTION
    WHEN sqlstate 'PT429' THEN
      RAISE NOTICE 'TEST 6b FAIL: idempotent retry was rate-limited — the early return must precede the rate check';
    WHEN others THEN
      RAISE NOTICE 'TEST 6b FAIL: unexpected SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- clear the rate fixtures so they don't pollute inbox/thread counts below.
DELETE FROM public.messages
  WHERE sender_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND recipient_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND id::text LIKE '66666666-%';

-- ============================================================
-- TEST 7: get_inbox returns one row per peer with a correct unread_count.
-- Seed (as postgres): B→A x2 unread + A→B x1 (one peer = B), and C→A x1 unread
-- (second peer = C). A's inbox should be exactly 2 rows; unread from B = 2, from C = 1.
-- (C→A needs C↔A connected for realism; it is. A→B/B→A use the A↔B edge.)
-- ============================================================
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc, created_at, read_at) VALUES
  ('77777777-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', extensions.pgp_sym_encrypt('B→A unread 1', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')), now() - interval '5 min', NULL),
  ('77777777-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', extensions.pgp_sym_encrypt('B→A unread 2', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')), now() - interval '4 min', NULL),
  ('77777777-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', extensions.pgp_sym_encrypt('A→B reply', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')),    now() - interval '3 min', NULL),
  ('77777777-0000-0000-0000-000000000004','cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', extensions.pgp_sym_encrypt('C→A unread 1', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')),  now() - interval '2 min', NULL)
ON CONFLICT (id) DO NOTHING;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE
    n_rows     int;
    unread_b   int;
    unread_c   int;
    last_b     text;
  BEGIN
    SELECT count(*) INTO n_rows FROM public.get_inbox();

    SELECT i.unread_count, i.last_body INTO unread_b, last_b
      FROM public.get_inbox() i WHERE i.peer_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    SELECT i.unread_count INTO unread_c
      FROM public.get_inbox() i WHERE i.peer_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF n_rows = 2 AND unread_b = 2 AND unread_c = 1 AND last_b = 'A→B reply'
    THEN RAISE NOTICE 'TEST 7 PASS: inbox has 1 row per peer (2), unread B=2 / C=1, last B-thread body correct';
    ELSE RAISE NOTICE 'TEST 7 FAIL: rows=% unread_b=% unread_c=% last_b=% (expected 2 / 2 / 1 / ''A→B reply'')', n_rows, unread_b, unread_c, last_b;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 8: get_thread returns both-direction messages newest-first, and a
-- NON-participant (C) gets nothing for the A↔B thread.
-- Uses the same 4 fixtures from test 7 (3 of them are A↔B: 2 B→A + 1 A→B).
-- ============================================================
-- 8a: A reads the A↔B thread — 3 rows, ordered created_at DESC (the A→B reply is newest).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE
    n        int;
    ordered  boolean;
    head_b   text;
  BEGIN
    -- WITH ORDINALITY numbers the function's rows in the ORDER IT EMITS THEM, so
    -- this tests the RPC's own `ORDER BY created_at DESC` (not a re-sort we impose).
    SELECT count(*) INTO n
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') WITH ORDINALITY;

    -- head of the emitted order must be the newest row (the A→B reply, t-3min).
    SELECT s.body INTO head_b FROM (
      SELECT t.body, ord
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') WITH ORDINALITY AS t(id, sender_id, recipient_id, body, created_at, read_at, ord)
      ORDER BY ord ASC LIMIT 1
    ) s;

    -- emitted created_at must be non-increasing as ordinality increases (newest-first).
    SELECT bool_and(created_at <= prev_created) INTO ordered FROM (
      SELECT t.created_at,
             lag(t.created_at) OVER (ORDER BY ord) AS prev_created
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') WITH ORDINALITY AS t(id, sender_id, recipient_id, body, created_at, read_at, ord)
    ) s WHERE prev_created IS NOT NULL;

    IF n = 3 AND head_b = 'A→B reply' AND COALESCE(ordered, true)
    THEN RAISE NOTICE 'TEST 8a PASS: A↔B thread has 3 both-direction rows, emitted newest-first (head = ''A→B reply'')';
    ELSE RAISE NOTICE 'TEST 8a FAIL: rows=% head=% newest_first=% (expected 3 / ''A→B reply'' / t)', n, head_b, ordered;
    END IF;
  END $$;
ROLLBACK;

-- 8b: C asks for the A↔B thread (peer = B). C is a non-participant of those rows,
--     and the RPC re-scopes every read to auth.uid(), so C must get 0 rows.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    IF n = 0
    THEN RAISE NOTICE 'TEST 8b PASS: non-participant C gets 0 rows for the A↔B thread (read re-scoped to auth.uid())';
    ELSE RAISE NOTICE 'TEST 8b FAIL: C saw % rows of the A↔B thread — leak', n;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 9: mark_thread_read — the recipient (A) clears unread from one peer (B)
-- WITHOUT touching another peer's messages (C→A stays unread).
-- Single transaction: mark, then re-read both peers' unread via get_inbox.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE unread_b int; unread_c int;
  BEGIN
    PERFORM public.mark_thread_read('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

    SELECT COALESCE(MAX(i.unread_count), 0) INTO unread_b
      FROM public.get_inbox() i WHERE i.peer_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    SELECT COALESCE(MAX(i.unread_count), 0) INTO unread_c
      FROM public.get_inbox() i WHERE i.peer_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF unread_b = 0 AND unread_c = 1
    THEN RAISE NOTICE 'TEST 9 PASS: mark_thread_read cleared B''s unread (→0) and left C''s untouched (=1)';
    ELSE RAISE NOTICE 'TEST 9 FAIL: after mark, unread_b=% unread_c=% (expected 0 / 1)', unread_b, unread_c;
    END IF;
  END $$;
ROLLBACK;

-- clear test 7/8/9 fixtures before the block tests
DELETE FROM public.messages WHERE id::text LIKE '77777777-%';

-- ============================================================
-- TEST 10: block_user / unblock_user round-trip; double-block is a no-op (one row).
-- ============================================================
-- 10a: A blocks C once, then again (double-block) → exactly one row; then unblock → zero.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n_after_double int; n_after_unblock int;
  BEGIN
    PERFORM public.block_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
    PERFORM public.block_user('cccccccc-cccc-cccc-cccc-cccccccccccc');  -- ON CONFLICT DO NOTHING → no-op

    SELECT count(*) INTO n_after_double FROM public.blocks
      WHERE blocker_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        AND blocked_id='cccccccc-cccc-cccc-cccc-cccccccccccc';

    PERFORM public.unblock_user('cccccccc-cccc-cccc-cccc-cccccccccccc');

    SELECT count(*) INTO n_after_unblock FROM public.blocks
      WHERE blocker_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        AND blocked_id='cccccccc-cccc-cccc-cccc-cccccccccccc';

    IF n_after_double = 1 AND n_after_unblock = 0
    THEN RAISE NOTICE 'TEST 10 PASS: block→double-block leaves 1 row; unblock removes it (0)';
    ELSE RAISE NOTICE 'TEST 10 FAIL: rows after double-block=% (want 1), after unblock=% (want 0)', n_after_double, n_after_unblock;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 11: the write-path lock — a direct INSERT INTO public.messages as the
-- `authenticated` role is rejected with insufficient_privilege (REVOKE INSERT),
-- proving send_message is the ONLY write path (so rate-limit/idempotency can't be bypassed).
-- A is connected to B, so RLS WITH CHECK would otherwise PASS — only the table-grant
-- REVOKE can be the thing that blocks this.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
    VALUES ('bbbbbbbb-9999-9999-9999-999999999999',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            convert_to('direct insert should be denied','utf8'));
    RAISE NOTICE 'TEST 11 FAIL: direct INSERT as authenticated was ALLOWED — write path not locked';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'TEST 11 PASS: direct INSERT denied (insufficient_privilege) — RPC is the only write path';
    WHEN others THEN
      RAISE NOTICE 'TEST 11 FAIL: expected insufficient_privilege, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ---------- final fixture cleanup (leave the DB as we found it) ----------
DELETE FROM public.messages WHERE id::text LIKE '55555555-%';
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

\echo '---- done. all lines above should read PASS ----'
