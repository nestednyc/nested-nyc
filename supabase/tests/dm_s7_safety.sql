-- ============================================================
-- DM Sprint 7 — Trust & Safety acceptance proof.  LOCAL SUPABASE ONLY.
-- Seeds auth.users directly (the on-signup trigger then creates profiles),
-- so NEVER run this against prod. Idempotent: re-running re-seeds cleanly.
--
-- Proves the THREE S7 safety guarantees the block/unblock UI and the privacy
-- stance rely on:
--   1. Block is symmetric + reversible — one block_user(B) by A stops sends in
--      BOTH directions (A→B and B→A) with PT403, and unblock_user(B) fully
--      restores A→B. (The UI's Block/Unblock contract.)
--   2. Rate-limit holds — the 11th send within 10s is rejected with PT429.
--   3. Account-deletion cascade — deleting an account removes ALL of its
--      messages (as sender AND recipient) and blocks (as blocker AND blocked),
--      while unrelated rows survive. ("Deleting an account removes its messages.")
--
-- Run:  supabase start
--       psql "$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL=//p' | tr -d '\"')" \
--            -f supabase/tests/dm_s7_safety.sql
--   (or:  docker exec -i supabase_db_nested psql -U postgres -v ON_ERROR_STOP=1 \
--            < supabase/tests/dm_s7_safety.sql)
--   (or paste into Studio's SQL editor). Read the NOTICE lines: every test
--   should print PASS. Any FAIL (or an uncaught ERROR) means a guarantee is wrong.
--
-- Depends on: 20260621000000_add_messages_and_blocks.sql (tables + FK cascades),
--             20260622000000_dm_rpcs.sql (send/block/unblock + rate-limit),
--             20260623000000_dm_encrypt_bodies.sql (Vault key 'dm_body_key').
--
-- Fixtures:  A — connected to B   (aaaaaaaa…)
--            B — connected to A    (bbbbbbbb…)
--            C — bystander, for the cascade "unrelated row survives" control
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

-- A ↔ B connection (directed; the gate accepts either direction, so both A→B and B→A pass the connection check)
INSERT INTO public.connections (user_id, target_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT DO NOTHING;

\echo '---- running S7 safety acceptance tests (watch for PASS/FAIL) ----'

-- ============================================================
-- TEST 1: a single block is SYMMETRIC and REVERSIBLE.
-- 1a: A blocks B (must COMMIT so the next transactions see it).
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  SELECT public.block_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');  -- top-level SELECT (PERFORM is plpgsql-only)
COMMIT;

-- 1b: A→B is now blocked (A is the blocker).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '70000000-0000-0000-0000-000000000a01',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'A to B while A blocks B') AS m;
    RAISE NOTICE 'TEST 1b FAIL: A→B send was ALLOWED despite A blocking B (body=%)', v_body;
  EXCEPTION
    WHEN sqlstate 'PT403' THEN RAISE NOTICE 'TEST 1b PASS: A→B rejected (PT403) — the blocker cannot message the blocked';
    WHEN others THEN RAISE NOTICE 'TEST 1b FAIL: expected PT403, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- 1c: B→A is ALSO blocked by the SAME block (symmetry — is_blocked_with checks both directions).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '70000000-0000-0000-0000-000000000b01',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             'B to A while A blocks B') AS m;
    RAISE NOTICE 'TEST 1c FAIL: B→A send was ALLOWED despite A blocking B (body=%)', v_body;
  EXCEPTION
    WHEN sqlstate 'PT403' THEN RAISE NOTICE 'TEST 1c PASS: B→A also rejected (PT403) — one block stops BOTH directions';
    WHEN others THEN RAISE NOTICE 'TEST 1c FAIL: expected PT403, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- 1d: A unblocks B (must COMMIT so the restore is visible to the next transaction).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  SELECT public.unblock_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
COMMIT;

-- 1e: after unblock, A→B succeeds again (messaging fully restored).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '70000000-0000-0000-0000-000000000a02',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'A to B after unblock') AS m;
    IF v_body = 'A to B after unblock'
    THEN RAISE NOTICE 'TEST 1e PASS: after unblock, A→B succeeds again (messaging restored)';
    ELSE RAISE NOTICE 'TEST 1e FAIL: unexpected body=%', v_body;
    END IF;
  EXCEPTION
    WHEN others THEN RAISE NOTICE 'TEST 1e FAIL: A→B still blocked after unblock — SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 2: rate-limit (10 per 10 seconds). Seed 10 A→B within the window as
-- postgres (fixtures, not via the RPC), then A's 11th send must be PT429.
-- ============================================================
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc, created_at)
SELECT
  ('71000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  convert_to('rate fixture ' || g, 'utf8'),   -- body content is irrelevant; the limit counts rows in the window
  now() - (g * interval '50 milliseconds')    -- all comfortably inside the 10s window
FROM generate_series(1, 10) AS g
ON CONFLICT (id) DO NOTHING;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_body text;
  BEGIN
    SELECT m.body INTO v_body FROM public.send_message(
             '71000000-1111-1111-1111-111111111111',  -- a fresh id (not idempotent)
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'the 11th message — over the limit') AS m;
    RAISE NOTICE 'TEST 2 FAIL: 11th send was ALLOWED despite 10 in the window (body=%)', v_body;
  EXCEPTION
    WHEN sqlstate 'PT429' THEN RAISE NOTICE 'TEST 2 PASS: 11th send within 10s rejected (PT429 / rate_limited)';
    WHEN others THEN RAISE NOTICE 'TEST 2 FAIL: expected PT429, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- clear the rate fixtures so they don't muddy the cascade counts below.
DELETE FROM public.messages WHERE id::text LIKE '71000000-%';

-- ============================================================
-- TEST 3: account-deletion CASCADE. Deleting A's auth.users row must remove
-- every message A is party to (as sender AND recipient) and every block A is
-- party to (as blocker AND blocked), while an unrelated B→C message survives.
-- Run LAST — it deletes user A.
-- ============================================================
-- Seed (as postgres — bypasses RLS/REVOKE): A↔B messages both ways, A↔B blocks
-- both ways, plus a B→C control that does NOT involve A.
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc) VALUES
  ('73000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', convert_to('A→B (cascade fixture)','utf8')),
  ('73000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', convert_to('B→A (cascade fixture)','utf8')),
  ('73000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-cccccccccccc', convert_to('B→C (unrelated control)','utf8'))
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.blocks (blocker_id, blocked_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT DO NOTHING;

-- The deletion under test (cascades: auth.users → profiles → messages + blocks).
DELETE FROM auth.users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

DO $$
DECLARE n_msg int; n_blk int; n_ctrl int;
BEGIN
  SELECT count(*) INTO n_msg FROM public.messages
    WHERE sender_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       OR recipient_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT count(*) INTO n_blk FROM public.blocks
    WHERE blocker_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       OR blocked_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT count(*) INTO n_ctrl FROM public.messages
    WHERE id = '73000000-0000-0000-0000-000000000003';   -- the B→C control

  IF n_msg = 0 AND n_blk = 0 AND n_ctrl = 1
  THEN RAISE NOTICE 'TEST 3 PASS: deleting A cascaded away its messages (both directions) + blocks (both directions); unrelated B→C survived';
  ELSE RAISE NOTICE 'TEST 3 FAIL: A-messages=% A-blocks=% control=% (expected 0 / 0 / 1)', n_msg, n_blk, n_ctrl;
  END IF;
END $$;

-- ---------- final fixture cleanup (A already gone via the cascade test) ----------
DELETE FROM auth.users WHERE id IN (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

\echo '---- done. all lines above should read PASS ----'
