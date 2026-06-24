-- ============================================================
-- DM Sprint 8 — "delete conversation" (delete-for-me) acceptance proof.
-- LOCAL SUPABASE ONLY. Seeds auth.users directly (the on-signup trigger then
-- creates profiles), so NEVER run this against prod. Idempotent: re-running
-- re-seeds cleanly.
--
-- Proves the delete-for-me watermark contract (conversation_clears +
-- delete_conversation + the clear-aware get_inbox/get_thread):
--   1. A's clear hides every message up to the watermark from A's get_thread,
--      but messages AFTER it stay (reappear-on-new-message).
--   2. A's get_inbox drops the cleared thread / recomputes unread over only the
--      still-visible (post-watermark) messages.
--   3. The peer B is UNAFFECTED — B still sees the whole thread and inbox row.
--   4. delete_conversation(B) actually sets the watermark to ~now() (idempotent
--      upsert bumps it forward), so a real RPC clear hides the whole thread.
--   5. A brand-new message after a real RPC clear reappears for A.
--   6. self-delete → PT422; unauthenticated → PT401.
--
-- Run:  supabase start
--       psql "$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL=//p' | tr -d '\"')" \
--            -f supabase/tests/dm_s8_acceptance.sql
--   (or:  docker exec -i supabase_db_nested psql -U postgres -v ON_ERROR_STOP=1 \
--            < supabase/tests/dm_s8_acceptance.sql)
--   (or paste into Studio's SQL editor). Read the NOTICE lines: every test
--   should print PASS. Any FAIL (or an uncaught ERROR) means the model is wrong.
--
-- Depends on: 20260621000000_add_messages_and_blocks.sql (messages table),
--             20260622000000_dm_rpcs.sql (RPC seam),
--             20260623000000_dm_encrypt_bodies.sql (Vault key 'dm_body_key' — the
--               seeded bodies are pgp_sym_encrypt'd so get_thread/get_inbox decrypt),
--             20260624000000_dm_delete_conversation.sql (THIS sprint).
--
-- Fixtures:  A (aaaaaaaa…) connected to B (bbbbbbbb…). Three seeded messages and
--            an A-side clear watermark BETWEEN the old pair and the new one.
-- ============================================================

-- ---------- CLEAN SLATE (cascades: auth.users → profiles → messages/blocks/connections/conversation_clears) ----------
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- ---------- SEED USERS (trigger handle_new_user auto-creates the profiles rows; .edu required) ----------
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','dm8_a@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','dm8_b@nyu.edu', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '');

-- A → B connection (the gate accepts either direction).
INSERT INTO public.connections (user_id, target_id)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT DO NOTHING;

-- Seed three messages (as postgres → bypasses RLS/REVOKE). Bodies are encrypted
-- with the Vault key so the decrypting get_thread/get_inbox return real plaintext.
-- Two OLD (now()-2h): A→B, and an UNREAD B→A. One NEW (now()): an UNREAD B→A.
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc, created_at, read_at) VALUES
  ('80000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     extensions.pgp_sym_encrypt('old A to B', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')), now() - interval '2 hours', NULL),
  ('80000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     extensions.pgp_sym_encrypt('old B to A', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')), now() - interval '2 hours', NULL),
  ('80000000-0000-0000-0000-000000000003','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     extensions.pgp_sym_encrypt('new B to A', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')), now(), NULL)
ON CONFLICT (id) DO NOTHING;

-- A's clear watermark, set BETWEEN the old pair (now()-2h, hidden) and the new
-- message (now(), visible). Seeded directly to make the filtering deterministic.
INSERT INTO public.conversation_clears (user_id, peer_id, cleared_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', now() - interval '1 hour')
ON CONFLICT (user_id, peer_id) DO UPDATE SET cleared_at = EXCLUDED.cleared_at;

\echo '---- running S8 delete-conversation acceptance tests (watch for PASS/FAIL) ----'

-- ============================================================
-- TEST 1: A's get_thread returns ONLY the post-watermark message (reappear),
--         the two pre-watermark messages are hidden from A.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int; only_body text;
  BEGIN
    SELECT count(*), max(t.body) INTO n, only_body
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') AS t;
    IF n = 1 AND only_body = 'new B to A'
    THEN RAISE NOTICE 'TEST 1 PASS: A sees only the 1 post-clear message ("%"); the 2 pre-clear messages are hidden', only_body;
    ELSE RAISE NOTICE 'TEST 1 FAIL: A get_thread returned % rows (body=%) — expected 1 ("new B to A")', n, only_body;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 2: A's get_inbox keeps the thread (a newer message exists) but unread is
--         recomputed over only the visible messages: 1 (the new B→A), NOT 2.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE v_last text; v_unread bigint;
  BEGIN
    SELECT i.last_body, i.unread_count INTO v_last, v_unread
      FROM public.get_inbox() AS i
      WHERE i.peer_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    IF v_last = 'new B to A' AND v_unread = 1
    THEN RAISE NOTICE 'TEST 2 PASS: A inbox row for B shows last="%", unread=% (pre-clear unread does not count)', v_last, v_unread;
    ELSE RAISE NOTICE 'TEST 2 FAIL: A inbox last=% unread=% — expected "new B to A" / 1', v_last, v_unread;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 3: the PEER (B) is UNAFFECTED — A's clear is A's alone. B still sees the
--         whole 3-message thread and an inbox row for A.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int; has_row boolean;
  BEGIN
    SELECT count(*) INTO n FROM public.get_thread('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') AS t;
    SELECT EXISTS (SELECT 1 FROM public.get_inbox() AS i WHERE i.peer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') INTO has_row;
    IF n = 3 AND has_row
    THEN RAISE NOTICE 'TEST 3 PASS: B still sees all 3 messages + an inbox row for A (A''s clear did not touch B)';
    ELSE RAISE NOTICE 'TEST 3 FAIL: B get_thread=% (expected 3), inbox row for A=% (expected true)', n, has_row;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 4: delete_conversation(B) RPC sets A's watermark to ~now() (idempotent
--         upsert over the seeded now()-1h one), so afterwards A's whole thread is
--         hidden (the previously-visible "new B to A" is now ≤ the fresh mark).
-- 4a: A clears via the RPC (COMMIT so 4b/5 see it), then assert the watermark
--     advanced to ~now() (read back as the default superuser role).
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  SELECT public.delete_conversation('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');  -- top-level SELECT (void)
COMMIT;

DO $$
DECLARE v timestamptz;
BEGIN
  SELECT cleared_at INTO v FROM public.conversation_clears
    WHERE user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND peer_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF v IS NOT NULL AND v > now() - interval '1 minute'
  THEN RAISE NOTICE 'TEST 4a PASS: delete_conversation upserted the watermark forward to ~now() (%)', v;
  ELSE RAISE NOTICE 'TEST 4a FAIL: watermark not advanced to ~now() (=%)', v;
  END IF;
END $$;

-- 4b: after the real RPC clear, A's thread is now empty (everything ≤ now()).
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int;
  BEGIN
    SELECT count(*) INTO n FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') AS t;
    IF n = 0
    THEN RAISE NOTICE 'TEST 4b PASS: after delete_conversation, A''s whole thread is hidden (0 rows)';
    ELSE RAISE NOTICE 'TEST 4b FAIL: A still sees % messages after delete_conversation (expected 0)', n;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 5: reappear-on-new-message after a REAL RPC clear. A brand-new B→A
--         message (created after the watermark) shows up for A again.
-- ============================================================
INSERT INTO public.messages (id, sender_id, recipient_id, body_enc, created_at) VALUES
  ('80000000-0000-0000-0000-000000000004','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     extensions.pgp_sym_encrypt('B messages A again', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='dm_body_key')), now() + interval '1 hour')
ON CONFLICT (id) DO NOTHING;

BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE n int; only_body text;
  BEGIN
    SELECT count(*), max(t.body) INTO n, only_body
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') AS t;
    IF n = 1 AND only_body = 'B messages A again'
    THEN RAISE NOTICE 'TEST 5 PASS: a new message after the clear reappears for A ("%")', only_body;
    ELSE RAISE NOTICE 'TEST 5 FAIL: A get_thread=% body=% — expected 1 ("B messages A again")', n, only_body;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 6: guard rails — self-delete → PT422, unauthenticated → PT401.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    PERFORM public.delete_conversation('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    RAISE NOTICE 'TEST 6a FAIL: delete_conversation(self) was ALLOWED';
  EXCEPTION
    WHEN sqlstate 'PT422' THEN RAISE NOTICE 'TEST 6a PASS: delete_conversation(self) rejected (PT422)';
    WHEN others THEN RAISE NOTICE 'TEST 6a FAIL: expected PT422, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

BEGIN;
  -- authenticated role but NO jwt claims → auth.uid() is NULL → PT401.
  SET LOCAL ROLE authenticated;
  DO $$
  BEGIN
    PERFORM public.delete_conversation('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    RAISE NOTICE 'TEST 6b FAIL: delete_conversation with no auth was ALLOWED';
  EXCEPTION
    WHEN sqlstate 'PT401' THEN RAISE NOTICE 'TEST 6b PASS: unauthenticated delete_conversation rejected (PT401)';
    WHEN others THEN RAISE NOTICE 'TEST 6b FAIL: expected PT401, got SQLSTATE % (%)', SQLSTATE, SQLERRM;
  END $$;
ROLLBACK;

-- ---------- fixture cleanup ----------
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

\echo '---- done. all lines above should read PASS ----'
