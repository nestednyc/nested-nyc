# DM Sprint 2 — Build Spec (RPC seam + service + adapter)

**Status:** ready to implement · derived from the S2 planning blueprint, reviewed & corrected 2026-06-22.
**Depends on:** S1 (done; gate helpers `is_connected_to(target)` / `is_blocked_with(target)` are self-scoped to `auth.uid()`, in the working tree).
**Out of scope here:** encryption (S3 — bodies stay UTF-8 via `convert_to`/`convert_from`), realtime delivery (S6), all UI (S4).

---

## Corrections applied during review (these differ from a naive reading — do them)

1. **Idempotency lookup MUST be caller-scoped.** In `send_message`, the "already sent?" check is
   `WHERE id = p_id AND sender_id = auth.uid()` — **never** `WHERE id = p_id` alone. A `SECURITY DEFINER`
   function bypasses RLS, so an unscoped lookup would return *another user's* message (sender/recipient/body)
   for a guessed id — the same class of leak we just fixed in the S1 helpers. A foreign id then falls through
   to the INSERT and fails on the PK, revealing nothing.
2. **Every read inside every `SECURITY DEFINER` RPC re-scopes to `auth.uid()`.** Standing rule from the S1 fix.
   `get_thread`/`get_inbox`/`mark_thread_read` all already filter on `auth.uid()` — keep it that way.
3. **Error signaling via PostgREST HTTP-status SQLSTATEs.** `RAISE EXCEPTION` with `ERRCODE 'PT401' | 'PT403' |
   'PT429' | 'PT422'` (PostgREST maps `PTxxx` → HTTP status xxx). The service maps on **`error.code`** (the
   SQLSTATE), not substrings of `error.message`.
4. **plpgsql `RETURNS TABLE` column care.** Qualify table columns (`m.created_at`, …) and avoid OUT-param /
   column-name ambiguity in `send_message` and the `get_*` functions.

---

## Migration: `supabase/migrations/20260622000000_dm_rpcs.sql`

(next free timestamp after the S1 migration; confirm no later file exists). Six `SECURITY DEFINER`,
`SET search_path = public` functions. Bodies are plaintext via `convert_to(p_body,'utf8')` /
`convert_from(body_enc,'utf8')` — **S3 swaps ONLY these two calls** to `pgp_sym_encrypt`/`pgp_sym_decrypt`.

- **`send_message(p_id uuid, p_recipient uuid, p_body text)` RETURNS TABLE(id, sender_id, recipient_id, body text, created_at, read_at)** — order:
  1. `v_sender := auth.uid()`; null → `RAISE … ERRCODE 'PT401'` (`not_authenticated`).
  2. `p_recipient = v_sender` → `PT422` (`self_message`).
  3. **Idempotency:** `SELECT … WHERE id = p_id AND sender_id = v_sender` → if FOUND, RETURN it and stop (no gate, no rate charge).
  4. **Gate:** `NOT is_connected_to(p_recipient)` → `PT403` (`not_connected`); `is_blocked_with(p_recipient)` → `PT403` (`blocked`).
  5. **Rate-limit (10 / 10s):** `COUNT(*) WHERE sender_id = v_sender AND created_at > now() - interval '10 seconds'` ≥ 10 → `PT429` (`rate_limited`).
  6. **INSERT** with `sender_id = v_sender` (never trust a client-supplied sender), `body_enc = convert_to(p_body,'utf8')`.
  7. RETURN the inserted row (body as plaintext via `convert_from`).
- **`get_inbox()` RETURNS TABLE(peer_id, last_body text, last_at, last_sender, unread_count)** — latest message
  per conversation peer where caller is sender OR recipient (`DISTINCT ON` the peer expression
  `CASE WHEN sender_id = auth.uid() THEN recipient_id ELSE sender_id END`); `unread_count` = messages where
  `recipient_id = auth.uid() AND read_at IS NULL`, grouped by sender. `STABLE`.
- **`get_thread(p_peer uuid, p_since timestamptz default null, p_limit int default 50)` RETURNS TABLE(id, sender_id, recipient_id, body text, created_at, read_at)** —
  both directions between `auth.uid()` and `p_peer`; `(p_since IS NULL OR created_at < p_since)`;
  `ORDER BY created_at DESC LIMIT LEAST(p_limit, 100)`. `STABLE`. (Keyset on `created_at` is fine for S2; a
  `(created_at, id)` cursor is deferred to S5.)
- **`mark_thread_read(p_peer uuid)` RETURNS void** — `UPDATE messages SET read_at = now() WHERE recipient_id = auth.uid() AND sender_id = p_peer AND read_at IS NULL`.
- **`block_user(p_target uuid)` RETURNS void** — auth + self-check (`PT422`); `INSERT INTO blocks(blocker_id, blocked_id) VALUES (auth.uid(), p_target) ON CONFLICT DO NOTHING`. Does **not** remove the connection (v1).
- **`unblock_user(p_target uuid)` RETURNS void** — `DELETE FROM blocks WHERE blocker_id = auth.uid() AND blocked_id = p_target`.

**Lock the write path:** `REVOKE INSERT ON public.messages FROM authenticated, anon;` — the RPC becomes the only
write path so rate-limit + idempotency can't be bypassed. The S1 `UPDATE(read_at)` column lock stays;
`mark_thread_read` still works because `SECURITY DEFINER` runs as owner.

**Grants (per function, the `20260614000000_atomic_close_project_role.sql` recipe):**
`REVOKE EXECUTE … FROM PUBLIC, anon;` then `GRANT EXECUTE … TO authenticated;`. End the file with
`NOTIFY pgrst, 'reload schema';`.

---

## Service: `src/services/messageService.js`

Mirror `connectionService.js` / `lookupService.js`: `isSupabaseConfigured()` early return, `supabase.auth.getUser()`
guard, `supabase.rpc('fn', {…})`, ALWAYS returns `{ data, error }`, NEVER throws (try/catch the call). Methods:
`sendMessage(id, recipientId, body)`, `getInbox()`, `getThread(peerId, since = null, limit = 50)`,
`markThreadRead(peerId)`, `blockUser(targetId)`, `unblockUser(targetId)`. Map RPC errors by **`error.code`**
(`PT401`→sign in · `PT403`/not_connected→"you can only message people you're connected to" · `PT403`/blocked→
vague "Unable to send message" · `PT429`→"sending too fast" · `PT422`→"can't message yourself"). Pass `user.id`
into the adapter transforms. `send_message` returns a SETOF row → take `data[0]`.

## Adapter: `src/design/messageAdapter.js`

Pure transforms like `projectAdapter.js` (no service/supabase imports): `fromDbMessage(row, myId)` →
`{ id, peerId, fromMe, body, createdAt, readAt }`; `fromDbInboxRow(row, myId)` →
`{ peerId, lastBody, lastAt, lastFromMe, unreadCount }`; `toDbMessage(body)` → `{ body: body.trim() }`.

---

## Verify (local)

1. Docker + local Supabase up (`supabase_db_nested`). Apply the new migration:
   `docker exec -i supabase_db_nested psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20260622000000_dm_rpcs.sql` (CLI is flaky in this env — `docker exec` psql is the reliable path).
2. Run `supabase/tests/dm_s2_acceptance.sql` (authored separately) via `docker exec -i … psql` — every line PASS.
3. Keep `supabase/tests/dm_s1_acceptance.sql` as a **pre-S2** historical proof (its direct INSERTs break after
   the REVOKE INSERT) — add a one-line header note; do not change its test logic.

## Reference files
`supabase/migrations/20260621000000_add_messages_and_blocks.sql` (S1 schema + the self-scoped helpers),
`supabase/migrations/20260614000000_atomic_close_project_role.sql` (REVOKE/GRANT recipe),
`supabase/migrations/008_lookup_functions.sql` (RPC EXECUTE grants),
`supabase/migrations/20260526000000_add_organizations.sql` (SECURITY DEFINER boilerplate),
`src/services/connectionService.js`, `src/services/lookupService.js`, `src/design/projectAdapter.js`,
`MESSAGING_PLAN.md` (Sprint 2 acceptance criteria).
