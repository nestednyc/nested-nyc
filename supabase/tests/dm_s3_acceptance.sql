-- ============================================================
-- DM Sprint 3 — ciphertext-at-rest acceptance proof.  LOCAL SUPABASE ONLY.
-- Seeds auth.users directly (the on-signup trigger then creates profiles),
-- so NEVER run this against prod. Idempotent: re-running re-seeds cleanly.
--
-- S2 proved the RPC seam end-to-end with PLAINTEXT bodies (convert_to/convert_from).
-- S3 swaps only those two calls for extensions.pgp_sym_encrypt / pgp_sym_decrypt,
-- keyed by the Vault secret `dm_body_key`. The dm_s2 suite STILL passes unchanged —
-- that's the transparency proof (decryption is invisible through the RPC seam).
-- THIS suite proves the complementary half: the stored bytes are genuinely
-- ENCRYPTED, not merely encoded.
--
-- Run:  supabase start
--       psql "$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL=//p' | tr -d '\"')" \
--            -f supabase/tests/dm_s3_acceptance.sql
--   (or:  docker exec -i supabase_db_nested psql -U postgres -v ON_ERROR_STOP=1 \
--            < supabase/tests/dm_s3_acceptance.sql)
--   (or paste into Studio's SQL editor). Read the NOTICE lines: every test
--   should print PASS. Any FAIL (or an uncaught ERROR) means the at-rest
--   encryption contract is wrong.
--
-- Depends on: migration 20260623000000_dm_encrypt_bodies.sql (the Vault key +
--             the three body-touching RPCs decrypting/encrypting) applied on top
--             of S2 (20260622000000) and S1 (20260621000000).
--
-- Fixtures:  A — connected to B   (aaaaaaaa…)
--            B — connected to A    (bbbbbbbb…)
--            C — connected to A only (cccccccc…)  (parity with the dm_s2 harness)
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
--   A → B  (the connected pair under test)
--   A → C  (parity with the dm_s2 fixture set; unused here)
INSERT INTO public.connections (user_id, target_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc')
ON CONFLICT DO NOTHING;

\echo '---- running S3 acceptance tests (watch for PASS/FAIL) ----'

-- ============================================================
-- SETUP: A (connected to B) sends one real message via send_message and COMMITs it,
-- so the script runner (postgres) and a later participant read both see the same
-- stored ciphertext row. (Tests 1/2/4 read body_enc directly as postgres; test 3
-- reads it back through the RPC as A. Cleaned up at the end.)
--   plaintext under test:  'cipher-at-rest probe body — A→B'
--   fixed message id:      'e3e3e3e3-0000-0000-0000-000000000001'
-- send_message is called at top level via SELECT (not PERFORM, which is plpgsql-only).
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  SELECT public.send_message(
           'e3e3e3e3-0000-0000-0000-000000000001',
           'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
           'cipher-at-rest probe body — A→B');
COMMIT;

-- ============================================================
-- TEST 1: the row stored by send_message is CIPHERTEXT at rest.
-- As the script runner (postgres — bypasses RLS/REVOKE), raw-SELECT body_enc and
-- assert: (a) it is bytea, (b) it does NOT equal the plaintext encoded as utf8,
-- and (c) it is NOT recoverable as the plaintext via convert_from(...,'utf8')
-- (i.e. the bytes are genuine PGP ciphertext, not utf8-encoded plaintext bytes).
-- convert_from on non-utf8 bytes can itself raise — that ALSO proves the point,
-- so the recover attempt is wrapped and any error counts toward PASS.
-- ============================================================
DO $$
DECLARE
  v_enc        bytea;
  v_typ        text;
  v_equals_pt  boolean;
  v_recovered  text;
  v_recover_ok boolean := false;   -- did convert_from return the plaintext?
  v_pt         text := 'cipher-at-rest probe body — A→B';
BEGIN
  SELECT body_enc, pg_typeof(body_enc)::text
    INTO v_enc, v_typ
    FROM public.messages
    WHERE id = 'e3e3e3e3-0000-0000-0000-000000000001';

  -- (b) ciphertext bytes must differ from the plaintext's utf8 encoding.
  v_equals_pt := (v_enc = convert_to(v_pt, 'utf8'));

  -- (c) try to read the stored bytes back as utf8 text; on success it must NOT
  --     be the plaintext. A decode error is fine (means definitely-not-utf8-text).
  BEGIN
    v_recovered := convert_from(v_enc, 'utf8');
    v_recover_ok := (v_recovered = v_pt);
  EXCEPTION WHEN others THEN
    v_recover_ok := false;   -- not utf8-decodable as the message → not plaintext
  END;

  IF v_typ = 'bytea' AND NOT v_equals_pt AND NOT v_recover_ok
  THEN RAISE NOTICE 'TEST 1 PASS: body_enc is bytea ciphertext (≠ plaintext utf8, not utf8-recoverable as the message)';
  ELSE RAISE NOTICE 'TEST 1 FAIL: typ=% equals_plaintext=% utf8_recovered_plaintext=%', v_typ, v_equals_pt, v_recover_ok;
  END IF;
END $$;

-- ============================================================
-- TEST 2: round-trip — decrypting body_enc with the CORRECT Vault key
-- (dm_body_key) returns the original plaintext. As postgres (the DEFINER owner
-- can read vault.decrypted_secrets; the script runner can too).
-- ============================================================
DO $$
DECLARE
  v_plain text;
  v_pt    text := 'cipher-at-rest probe body — A→B';
BEGIN
  SELECT extensions.pgp_sym_decrypt(
           body_enc,
           (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dm_body_key'))
    INTO v_plain
    FROM public.messages
    WHERE id = 'e3e3e3e3-0000-0000-0000-000000000001';

  IF v_plain = v_pt
  THEN RAISE NOTICE 'TEST 2 PASS: pgp_sym_decrypt(body_enc, dm_body_key) round-trips to the original plaintext';
  ELSE RAISE NOTICE 'TEST 2 FAIL: decrypted=% (expected %)', v_plain, v_pt;
  END IF;
END $$;

-- ============================================================
-- TEST 3: a participant reading through the RPC gets the correct PLAINTEXT.
-- As A (a party to the A↔B thread), get_thread('B') must decrypt body_enc and
-- return the original plaintext body — proving the RPC seam decrypts for an
-- authorized reader.
-- ============================================================
BEGIN;
  SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
  SET LOCAL ROLE authenticated;
  DO $$
  DECLARE
    v_body text;
    n      int;
  BEGIN
    SELECT count(*) INTO n
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') t
      WHERE t.id = 'e3e3e3e3-0000-0000-0000-000000000001';

    SELECT t.body INTO v_body
      FROM public.get_thread('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') t
      WHERE t.id = 'e3e3e3e3-0000-0000-0000-000000000001';

    IF n = 1 AND v_body = 'cipher-at-rest probe body — A→B'
    THEN RAISE NOTICE 'TEST 3 PASS: get_thread decrypts through the RPC — participant A reads the correct plaintext';
    ELSE RAISE NOTICE 'TEST 3 FAIL: rows=% body=% (expected 1 / the original plaintext)', n, v_body;
    END IF;
  END $$;
ROLLBACK;

-- ============================================================
-- TEST 4: decrypting body_enc with a WRONG key must FAIL — proving the body is
-- genuinely encrypted, not merely encoded. A correct key is the ONLY way back to
-- the plaintext. pgp_sym_decrypt with the wrong passphrase raises (typically
-- 'Wrong key or corrupt data'); the sub-block treats ANY error as PASS, and a
-- silent success (no error) as FAIL.
-- ============================================================
DO $$
DECLARE v_plain text;
BEGIN
  SELECT extensions.pgp_sym_decrypt(body_enc, 'wrong-key')
    INTO v_plain
    FROM public.messages
    WHERE id = 'e3e3e3e3-0000-0000-0000-000000000001';
  RAISE NOTICE 'TEST 4 FAIL: wrong-key decrypt did NOT fail (got body=%) — body is not truly encrypted', v_plain;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'TEST 4 PASS (via %): wrong-key decrypt failed (%) — body is genuinely encrypted', SQLSTATE, SQLERRM;
END $$;

-- ---------- final fixture cleanup (leave the DB as we found it) ----------
DELETE FROM public.messages WHERE id = 'e3e3e3e3-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

\echo '---- done. all lines above should read PASS ----'
