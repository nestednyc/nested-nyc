-- ============================================================
-- DM Sprint 1 — RLS acceptance proof.  LOCAL SUPABASE ONLY.
-- Seeds auth.users directly (the on-signup trigger then creates profiles),
-- so NEVER run this against prod. Idempotent: re-running re-seeds cleanly.
--
-- ⚠️ S1-STATE PROOF ONLY — run this against the schema BEFORE 20260622000000.
-- S2 does `REVOKE INSERT ON public.messages FROM authenticated`, so on the post-S2
-- schema TEST 1's direct INSERT raises insufficient_privilege as an uncaught ERROR
-- (not a clean FAIL). The RPC seam (dm_s2/s3 suites) is the proof from S2 onward.
--
-- Run:  supabase start
--       psql "$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL=//p' | tr -d '\"')" \
--            -f supabase/tests/dm_s1_acceptance.sql
--   (or paste into Studio's SQL editor). Read the NOTICE lines: every test
--   should print PASS. Any FAIL (or an uncaught ERROR) means the model is wrong.
--
-- Fixtures:  A — connected to B          (aaaaaaaa…)
--            B — connected to A, blocks A in test 3   (bbbbbbbb…)
--            C — connected to nobody      (cccccccc…)
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

-- A → B connection (directed; the gate accepts either direction)
INSERT INTO public.connections (user_id, target_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT DO NOTHING;

-- Baseline messages, seeded as the script runner (postgres bypasses RLS — these
-- are fixtures for the SELECT/UPDATE tests, not themselves under test):
--   M_AB  A → B  (for read/update tests)
--   M_BC  B → C  (for the "A can't see other people's messages" test)
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc) VALUES
  ('dddddddd-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', convert_to('hi B — from A','utf8')),
  ('dddddddd-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc', convert_to('B to C, private','utf8'))
ON CONFLICT (id) DO NOTHING;

\echo '---- running acceptance tests (watch for PASS/FAIL) ----'

-- ===== TEST 1: A (connected to B) can INSERT + SELECT a message to B =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
    VALUES (gen_random_uuid(),
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            convert_to('test-1 body','utf8'));
    SELECT count(*) INTO n FROM public.messages
      WHERE sender_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        AND recipient_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    IF n >= 1 THEN RAISE NOTICE 'TEST 1 PASS: A sent to B and can read it (% A→B rows visible)', n;
    ELSE RAISE NOTICE 'TEST 1 FAIL: A cannot see its own sent message'; END IF;
  END $$;
ROLLBACK;

-- ===== TEST 2: a non-connected sender (C → A) is rejected by RLS =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
    VALUES (gen_random_uuid(),
            'cccccccc-cccc-cccc-cccc-cccccccccccc',
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            convert_to('C to A (unconnected)','utf8'));
    RAISE NOTICE 'TEST 2 FAIL: unconnected insert was ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 2 PASS: unconnected insert rejected by RLS';
  END $$;
ROLLBACK;

-- ===== TEST 3: a CONNECTED but BLOCKED send is rejected, and the block is invisible to the sender =====
-- 3a: B blocks A (must COMMIT so the next, separate transaction sees it).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  ON CONFLICT DO NOTHING;
COMMIT;

-- 3b + 3c: as A — send is blocked (though still connected), and B's block row is hidden.
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
    VALUES (gen_random_uuid(),
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            convert_to('A to B after block','utf8'));
    RAISE NOTICE 'TEST 3b FAIL: blocked send was ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 3b PASS: blocked send rejected (connected but blocked)';
  END $$;

  SELECT count(*) AS a_can_see_bs_block
  FROM public.blocks
  WHERE blocker_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';  -- expect 0 (RLS hides B's block from A)
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.blocks
      WHERE blocker_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    IF n = 0 THEN RAISE NOTICE 'TEST 3c PASS: B''s block row is invisible to A (and the gate still enforced it via SECURITY DEFINER)';
    ELSE RAISE NOTICE 'TEST 3c FAIL: A can see % of B''s block rows', n; END IF;
  END $$;
ROLLBACK;

-- cleanup the block so the fixture set is back to baseline
DELETE FROM public.blocks
  WHERE blocker_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND blocked_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ===== TEST 4: A cannot SELECT a message between B and C =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.messages
      WHERE id='dddddddd-2222-2222-2222-222222222222';  -- the B↔C message
    IF n = 0 THEN RAISE NOTICE 'TEST 4 PASS: A cannot read the B↔C message';
    ELSE RAISE NOTICE 'TEST 4 FAIL: A can see a message it is not party to'; END IF;
  END $$;
ROLLBACK;

-- ===== TEST 5a: the recipient (B) CAN set read_at =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    UPDATE public.messages SET read_at = now()
      WHERE id='dddddddd-1111-1111-1111-111111111111';   -- M_AB; B is recipient
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 1 THEN RAISE NOTICE 'TEST 5a PASS: recipient B marked read (1 row)';
    ELSE RAISE NOTICE 'TEST 5a FAIL: % rows updated (expected 1)', n; END IF;
  END $$;
ROLLBACK;

-- ===== TEST 5b: the sender (A) CANNOT set read_at (row RLS filters it out) =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    UPDATE public.messages SET read_at = now()
      WHERE id='dddddddd-1111-1111-1111-111111111111';   -- M_AB; A is sender, not recipient
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE NOTICE 'TEST 5b PASS: sender A cannot mark read (0 rows; RLS filtered)';
    ELSE RAISE NOTICE 'TEST 5b FAIL: % rows updated (expected 0)', n; END IF;
  END $$;
ROLLBACK;

-- ===== TEST 5c: even the recipient (B) CANNOT rewrite body_enc (column privilege) =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    UPDATE public.messages SET body_enc = convert_to('tampered','utf8')
      WHERE id='dddddddd-1111-1111-1111-111111111111';
    RAISE NOTICE 'TEST 5c FAIL: body_enc rewrite was ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 5c PASS: body_enc rewrite rejected (column lock — only read_at is writable)';
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 6 — helper lockdown (post-fix): self-scoped, anon-revoked, no enumeration.
-- Guards the fix that closed the connection/block-graph enumeration leak: the RLS
-- helpers were reshaped from are_connected(a,b)/is_blocked_between(a,b) (world-
-- callable, any-pair) to is_connected_to(target)/is_blocked_with(target) (auth.uid()
-- self-scoped) + EXECUTE revoked from PUBLIC, anon.
-- ============================================================

-- ===== TEST 6a: authenticated KEPT EXECUTE (so the INSERT policy can still evaluate
-- the helpers), and the self-scoped logic is correct for the caller (A↔B connected). =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE c boolean; b boolean;
  BEGIN
    SELECT public.is_connected_to('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO c;
    SELECT public.is_blocked_with('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO b;
    IF c AND NOT b THEN RAISE NOTICE 'TEST 6a PASS: authenticated can EXECUTE helpers (A→B connected=t, blocked=f)';
    ELSE RAISE NOTICE 'TEST 6a FAIL: connected=% blocked=% (expected t / f)', c, b; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 6a FAIL: authenticated lost EXECUTE on the helpers — the INSERT policy would break';
  END $$;
ROLLBACK;

-- ===== TEST 6b: anon can NO LONGER call either helper (regression for the confirmed
-- anon `POST /rest/v1/rpc/are_connected` exploit — PostgREST runs anon RPCs as role anon). =====
BEGIN;
  SET LOCAL ROLE anon;
  DO $$
  BEGIN
    PERFORM public.is_connected_to('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    RAISE NOTICE 'TEST 6b FAIL (connections): anon CAN call is_connected_to — graph still enumerable';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 6b PASS (connections): anon cannot call is_connected_to';
  END $$;
  DO $$
  BEGIN
    PERFORM public.is_blocked_with('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    RAISE NOTICE 'TEST 6b FAIL (blocks): anon CAN call is_blocked_with — block graph still enumerable';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 6b PASS (blocks): anon cannot call is_blocked_with';
  END $$;
ROLLBACK;

-- ===== TEST 6c: third-party enumeration is unexpressible. As C (connected to nobody),
-- the only question the API admits is "is C connected to / blocked with B" (f / f) —
-- there is no argument by which C can ask about the A↔B pair. (Old are_connected
-- ('A','B') would have leaked TRUE to caller C.) =====
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE c boolean; b boolean;
  BEGIN
    SELECT public.is_connected_to('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO c;
    SELECT public.is_blocked_with('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') INTO b;
    IF NOT c AND NOT b THEN RAISE NOTICE 'TEST 6c PASS: caller C learns only its OWN relations (C↔B=f/f); no A↔B probe possible';
    ELSE RAISE NOTICE 'TEST 6c FAIL: C sees connected=% blocked=% — third-party data leaking', c, b; END IF;
  END $$;
ROLLBACK;

-- ===== TEST 6d: the dangerous 2-arg overloads must not exist; the self-scoped 1-arg
-- versions must. Catches a botched rename / a clean DB that still carries the old fns. =====
DO $$
BEGIN
  IF to_regprocedure('public.are_connected(uuid,uuid)')      IS NULL
 AND to_regprocedure('public.is_blocked_between(uuid,uuid)') IS NULL
 AND to_regprocedure('public.is_connected_to(uuid)')         IS NOT NULL
 AND to_regprocedure('public.is_blocked_with(uuid)')         IS NOT NULL
  THEN RAISE NOTICE 'TEST 6d PASS: 2-arg helpers gone; self-scoped 1-arg helpers present';
  ELSE RAISE NOTICE 'TEST 6d FAIL: are_connected2=%, is_blocked_between2=%, is_connected_to1=%, is_blocked_with1=%',
       to_regprocedure('public.are_connected(uuid,uuid)'),
       to_regprocedure('public.is_blocked_between(uuid,uuid)'),
       to_regprocedure('public.is_connected_to(uuid)'),
       to_regprocedure('public.is_blocked_with(uuid)');
  END IF;
END $$;

\echo '---- done. all lines above should read PASS ----'
