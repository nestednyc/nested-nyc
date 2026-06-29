# Direct Messaging — Build Plan

**Status:** Planning · **Created:** 2026-06-21 · **Owner:** tech lead + 1
**Scope:** 1:1 student↔student DMs. **Option A** (transport + RLS, baseline secure) **+ Option B** (message bodies encrypted at rest; server can read — *not* E2EE).

> How to use this doc: build one sprint at a time. A sprint is "done" only when every box in its **Acceptance** list is checked. Don't start a sprint before its **Depends on** sprint is green.

---

## Decisions locked

- **Encryption: Option B** — bodies encrypted at rest, server holds the key (in Supabase Vault). Enables search/moderation/notifications. Rejected E2EE (Option C) because it fights moderation and is weak in a browser.
- **Gating model: connection-gated** — you can only DM someone you're connected to (reuses the `connections` graph). **Confirmed 2026-06-21:** "connected" = an edge in *either* direction (`connections.user_id`/`target_id`), not mutual. Message-requests (IG-style) is a future enhancement, not v1.
- **No app server** — encryption + gating + rate-limit live in **Postgres `SECURITY DEFINER` RPCs**, not a new backend tier. (Revisit a serverless write-path only if abuse/moderation later demands it.)
- **Schema: flat `messages` table** (no `conversations` table for v1 — the participant pair *is* the thread; `recipient_id` is the column Realtime filters on).
- **RPC seam from day one** so the encryption flip (Sprint 3) is a localized change the client never sees.

## Architecture at a glance

- **Data path:** browser → Supabase directly (PostgREST + RLS), as everywhere else in the app. DMs add **RPCs** as the access seam.
- **Security = two layers:** (1) **RLS** on the tables is the backstop for any direct access; (2) **RPCs** centralize the connection gate, rate-limit, idempotency, and encryption. RPCs are `SECURITY DEFINER` (they must read the Vault key), so they enforce their own authz; RLS protects the tables underneath.
- **Encryption:** one symmetric key in **Supabase Vault**; `pgcrypto`'s `pgp_sym_encrypt`/`pgp_sym_decrypt` inside the RPCs. `pgcrypto` is already enabled (`001_schema.sql`).
- **Realtime = a ping, not the payload.** An `INSERT` on `recipient_id=eq.<me>` signals "new message"; the client then **refetches via the decrypting RPC** (the stored row is ciphertext). On reconnect/tab-focus, refetch since last-seen id — Realtime is best-effort, the fetch is the source of truth.
- **Reference patterns in the codebase** (verified against the working tree 2026-06-21 on `feat/otp-auto-submit`; numbers still drift — re-grep before trusting one):
  - Realtime template: `src/design/NestedApp.jsx:575–613` — the `tm-self-<id>` `team_members` channel (auth via `supabase.realtime.setAuth`, `filter: "user_id=eq."+id`, cleanup `removeChannel`). Sprint 6 clones this verbatim.
  - Hydration `Promise.all`: `NestedApp.jsx:490–525` (inside the session-resolve effect, 462–538) — 10 service calls land in state; add `messageService.getInbox()` here.
  - Router codec: `src/design/router.js` — ROUTES 27–49, accessOf 57–59, BUILD 106–133, validateNext 140–148, titleFor 151–176. Param routes mirror `:id`→state (`detail`/`detailId`, `userProfile`/`profileViewUsername`).
  - Header dropdowns: `src/design/headerMenus.jsx` — `NotifPanel` 26–120, `AccountPanel` 125–147 (presentational, return `null` when closed; open/close + click-outside owned by NestedApp). The bell + unread `.dot` render *inline* at `NestedApp.jsx:1675–1698`; `AccountPanel` line 142 already reserves a slot for new menu rows. A `MessagesPanel` clones `NotifPanel`.
  - Icons — **no new icon needed** (`design/icons.jsx` only, never lucide): `chat` for the header/inbox, `send` for the composer; `message`/`mail` also exist.
  - RLS idioms: `20260602000001`/`20260602000002` (connections + both-direction SELECT), `20260606000002_scope_team_member_reads` (multi-arm `EXISTS` USING), `20260526000000_add_organizations` (`is_org_*` SECURITY DEFINER boilerplate: `LANGUAGE sql · SECURITY DEFINER · STABLE · SET search_path = public`). `pgcrypto` enabled in `001_schema.sql`. Realtime publish idiom: `20260603000000_realtime_team_members`.
  - Service / `.rpc()` / adapter style: `src/services/connectionService.js` (`{data,error}`, never throws), `.rpc()` invocation in `src/services/lookupService.js`, adapters `src/design/projectAdapter.js` (`to*`/`from*`, snake_case↔camelCase).

## Where it touches — integration seams

DMs are **purely additive** to the existing shell: new state + new renders, no existing flow changes. No `inbox`/`unread`/`message*` state exists yet (clean slate). `NestedApp.jsx` line numbers verified 2026-06-21 (they drift — re-grep).

| # | Seam | Where (file:lines) | What to add | Sprint |
|---|------|--------------------|-------------|--------|
| 1 | App-data state | `NestedApp.jsx` 126–139 (sets/arrays: `saved`126, `connected`134, `incoming`137, `projectRequests`138); dropdown toggles 218–220 | `inbox`, `unreadMessages`, `messageThreadId` state | 4–5 |
| 2 | Hydration | `NestedApp.jsx` 490–525 (`Promise.all`) | add `messageService.getInbox()`; rows → `inbox`, derive `unreadMessages` | 4 |
| 3 | Realtime | `NestedApp.jsx` 575–613 (`tm-self-<id>`) | clone as `dm-self-<me>`, filter `recipient_id=eq.<me>`; INSERT → bump unread + refetch open thread | 6 |
| 4 | Route renders | `NestedApp.jsx` 1821–1844 (pattern `route === "x" && createElement(…)`, see `notifications`/`saved`) | `route === "messages"` (inbox) + `route === "messageThread"` | 4–5 |
| 5 | Header icon + panel | bell inline `NestedApp.jsx` 1675–1698; badge math `incomingPending` 1218; dismiss-effect deps 222–230; **mobile** account sheet 1905–1924 (badge at 1920) | `chat` icon + `.dot` next to the bell; `MessagesPanel` in `headerMenus.jsx` (clone `NotifPanel`); add `messagesOpen` to dismiss deps; add a mobile-sheet row | 4 |
| 6 | URL mirror | boot parse 110–115, write-sync effect 273–306, popstate 407–424, `applyParsed` 349–404 | seed/build/parse `messageThreadId` (mirror `detailId`) | 4–5 |
| 7 | Router codec | `router.js` ROUTES 27–49, BUILD 106–133, accessOf 57–59, titleFor 151–176 | `/messages` + `/messages/:id` rows (`access:"student"`), BUILD entries, titleFor cases | 4–5 |
| 8 | Auth gate | `requireAuth` 435–441; `applyParsed` access check 349–404 | routes `access:"student"` (deep-link → returnTo → onboarding); gated action → `requireAuth("Sign in to message")` | 4–5 |
| 9 | Entry points | `people.jsx` PersonProfile ~130–136, `userProfile.jsx` ~85–92 | a "Message" button → open that user's thread | 5 |

> **Line numbers above are PRE-S4 and now stale** — `NestedApp.jsx` grew past 2400 lines as S4–S8 landed (the doc warns "re-grep before trusting"). Current DM integration points (as of the S8 commit, 2026-06-23): hydration `Promise.all` ~541–553 (`getInbox()`+`getMyBlocks()`); `dm-self` realtime ~687–767; thread loader ~789–821; block/unblock + **delete-conversation** handlers ~1330–1395; optimistic `sendThreadMessage` ~1462–1485; header chat icon + unread dot ~1965–1970; route renders (`messages`/`messageThread`) ~2137–2160; mobile sheet row ~2241–2243; Block/Delete `ConfirmModal`s ~2258–2280. **Re-grep by identifier (`dm-self`, `sendThreadMessage`, `confirmDelete`) rather than trusting these.**

## Data model (target)

```
messages
  id            uuid  PRIMARY KEY            -- CLIENT-supplied (idempotency key)
  sender_id     uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  recipient_id  uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  body_enc      bytea NOT NULL               -- S2: utf8 bytes · S3: pgp_sym_encrypt(...)
  created_at    timestamptz DEFAULT now()
  read_at       timestamptz
  CHECK (sender_id <> recipient_id)
  INDEX (recipient_id, created_at DESC)       -- inbox/unread + realtime filter
  INDEX (sender_id, recipient_id, created_at) -- thread fetch
  -- optional: generated "pair key" least()/greatest() for one-index thread lookup

blocks
  blocker_id  uuid REFERENCES profiles(id) ON DELETE CASCADE
  blocked_id  uuid REFERENCES profiles(id) ON DELETE CASCADE
  created_at  timestamptz DEFAULT now()
  PRIMARY KEY (blocker_id, blocked_id)
  CHECK (blocker_id <> blocked_id)

conversation_clears                                  -- S8: per-user "delete chat" watermark
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE
  peer_id     uuid REFERENCES profiles(id) ON DELETE CASCADE
  cleared_at  timestamptz DEFAULT now()              -- caller's get_inbox/get_thread hide created_at <= this
  PRIMARY KEY (user_id, peer_id)
  CHECK (user_id <> peer_id)

message_attachments                                  -- S10: files on a message (docs/images)
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
  message_id   uuid REFERENCES messages(id) ON DELETE CASCADE   -- cascades with the message/account
  storage_path text  NOT NULL                        -- <sender_uid>/<message_id>/<file> in the dm-attachments bucket
  mime_type    text  NOT NULL
  size_bytes   bigint
  file_name    text
  created_at   timestamptz DEFAULT now()
  -- writes via send_message only; participant-read RLS; bodies are encrypted at
  -- rest but Storage BLOBS are not — they're a private bucket gated by RLS (see S10).
```

**Storage:** bucket `dm-attachments` (private, 10 MB/file + mime allowlist). RLS on `storage.objects`: own-folder write (`<uid>/…`), participant read (the `message_id` in the path is a participant of the caller). Reads use short-lived signed URLs minted client-side.

**RPC surface (the stable client contract):**
`send_message(p_id, p_recipient, p_body, p_attachments)` (S10 adds `p_attachments jsonb`, default `[]`; body cap 4000) · `get_inbox()` (S10 adds `last_has_attachment`) · `get_thread(p_peer, p_since, p_limit)` (S10 adds an `attachments` column) · `mark_thread_read(p_peer)` · `block_user(p_target)` / `unblock_user(p_target)` · `get_my_blocks` (S7, client-side via RLS select) · `delete_conversation(p_peer)` (S8, clear-for-me watermark) · `report_user(...)` (planned — deferred)

---

## Sprints

| # | Sprint | Ships | Depends on |
|---|--------|-------|------------|
| 1 | Schema + RLS + blocks | DB foundation, security model provable via SQL | — |
| 2 | RPC seam + service (plaintext checkpoint) | working send/list/read/block from JS | 1 |
| 3 | **Option B: encryption at rest** | bodies encrypted; client unchanged | 2 |
| 4 | Inbox screen + routing + header badge | `/messages` list, unread dot | 3 |
| 5 | Thread screen + send (optimistic) | `/messages/:id`, two-way chat | 4 |
| 6 | Realtime delivery + reconnect-resync | live messages, no drops/dupes | 5 |
| 7 | Trust & Safety + privacy hardening | report, deletion, rate-limit, mobile/polish | 6 |
| 8 | Delete conversation (delete-for-me) | per-user clear watermark; thread reappears on new msg | 7 |
| 9 | Chat polish | delivery status (Sending/Delivered/Seen) + live receipts, load-older pagination, date dividers, failed-send retry, body length cap | 6 |
| 10 | Attachments (docs + images) | private Storage bucket, 10 MB/file + mime allowlist, per-message files | 2 |

> **Why encryption is Sprint 3 (before any UI):** the RPC seam means flipping encryption on touches only the function bodies — the client never changes. Landing it before the Messages UI is reachable means **no plaintext-DM window ever exists in prod**. The Sprint 2 "plaintext checkpoint" lives only at the SQL level during dev.

### Sprint 1 — Schema + RLS + blocks
**Goal:** the access model is provably correct before any other variable is introduced.
**Deliverables:**
- Migration: `messages` (`body_enc bytea` from the start — stores utf8 bytes until S3), `blocks`, indexes.
- RLS — `messages`: SELECT if `auth.uid() in (sender_id, recipient_id)`; INSERT if `sender_id = auth.uid()` AND connected (either direction, `connections`) AND not blocked (either direction); UPDATE `read_at` only by `recipient_id`. `blocks`: self-scoped SELECT/INSERT/DELETE.
- Add `messages` to the Realtime publication.
- **New file:** `supabase/migrations/20260621000000_add_messages_and_blocks.sql` (next free timestamp — last applied is `20260618000000_email_opt_out`). Copy connections RLS from `20260602000001`/`…02`, the multi-arm `EXISTS` USING from `20260606000002`, the realtime-publish DO-block from `20260603000000`. Note: that `tm` migration sets `REPLICA IDENTITY FULL`, but the messages ping is **INSERT-only** (an INSERT always carries the full new row) — only add `FULL` if you later stream `read_at`/deletes over realtime.
**Acceptance:**
- [x] A (connected to B) can INSERT + SELECT a message to B.
- [x] Non-connected, or blocked, INSERT is rejected by RLS.
- [x] A cannot SELECT any message between B and C.
- [x] B can set `read_at`; A cannot.
- [x] Verified against local Supabase (Docker) via SQL — all checks PASS 2026-06-21 (+ bonus: `read_at` column-lock proven). Proof script: `supabase/tests/dm_s1_acceptance.sql`.

### Sprint 2 — RPC seam + service + adapter (plaintext checkpoint)
**Goal:** the stable client contract works end-to-end, still plaintext for easy inspection.
**Deliverables:**
- `SECURITY DEFINER` RPCs: `send_message` (gate: connected + not blocked + **rate-limit** + **idempotent on `p_id`**), `get_inbox`, `get_thread`, `mark_thread_read`, `block_user`/`unblock_user`. Bodies via `convert_to/convert_from(...,'utf8')` for now.
- `src/services/messageService.js` (`{data,error}`, never throws; calls `.rpc()`).
- `src/design/messageAdapter.js` (`toDbMessage`/`fromDbMessage`).
**Acceptance:**
- [x] Send/list/read/block all work from a console/scratch harness against local Supabase. — `supabase/tests/dm_s2_acceptance.sql` (run against post-S3 schema).
- [x] Re-sending the same `p_id` does **not** create a duplicate (idempotency). — `dm_s2_acceptance.sql` TEST 4 + the cross-user-leak regression.
- [x] Exceeding the rate limit is rejected with a clear error. — `dm_s2_acceptance.sql` TEST 6 (PT429); also `dm_s7_safety.sql` TEST 2.
- [x] Service returns `{data,error}` and never throws. — `src/services/messageService.js` (try/caught RPC, error.code → copy).

> Code-complete & code-reviewed 2026-06-23. SQL boxes are proven by the committed `dm_s2_acceptance.sql`; re-run it against a local post-S3 Supabase for a fresh machine-local PASS.

### Sprint 3 — Option B: encryption at rest
**Goal:** bodies are ciphertext at rest; authorized reads return plaintext; client/service untouched.
**Deliverables:**
- Vault secret holding the symmetric key (read via `vault.decrypted_secrets` inside the DEFINER RPCs). **Vault is not in `supabase/migrations/` today** — create the secret out-of-band (Supabase dashboard, or Management API `/database/query` with an `sbp_` PAT) and record the key *name/id* here, never the key itself.
- Swap RPC internals to `pgp_sym_encrypt`/`pgp_sym_decrypt`. (Dev: truncate test rows; prod has none.)
- Confirm no plaintext bodies in logs / error messages.
**Acceptance:**
- [x] A raw `SELECT body_enc FROM messages` returns ciphertext bytes. — `dm_s3_acceptance.sql` TEST 1 (+ TEST 4 wrong-key decrypt fails).
- [x] `get_thread` returns correct plaintext to a participant. — `dm_s3_acceptance.sql` TEST 3 (pgp_sym_decrypt round-trip).
- [x] The realtime→refetch path returns decrypted text (verified in S6). — the `dm-self` ping refetches via the decrypting `get_thread`/`get_inbox` (NestedApp realtime block); browser-confirm in the S6 two-tab check.
- [x] No code change required in `messageService.js`. — confirmed: the S3 migration touched only the RPC bodies; `messageService.js`/`messageAdapter.js` are byte-identical, and `dm_s2_acceptance.sql` still passes through the seam unchanged (the transparency proof).

> Encryption is live (`pgp_sym_encrypt`, Vault key `dm_body_key`). **Precondition:** `messages` must be empty when the S3 migration applies — see the migration header. Re-run `dm_s3_acceptance.sql` on a local stack for a machine-local PASS.

### Sprint 4 — Inbox screen + routing + header badge
**Deliverables:**
- `src/design/messages.jsx` (presentational conversation list, cork-board styled, 860px mobile).
- Router: ROUTES/BUILD/titleFor for `/messages` (`access:"student"`).
- NestedApp: `inbox`/`unreadCount` state, `get_inbox()` in hydration, conditional render, **header "Messages" icon + unread dot**. (`feat/header-dropdowns` has merged to `main` — 909dff3 — so this is unblocked. Render the `chat` icon + `.dot` inline at `NestedApp.jsx:1675–1698`; add a `MessagesPanel` to `headerMenus.jsx` mirroring `NotifPanel`; mirror it into the mobile account sheet 1905–1924. See seams #5.)
**Acceptance:**
- [x] Signed-in user sees their conversations + unread badge; guest is gated (returnTo stash). — `messages.jsx` + `getInbox()` hydration; `unreadMessages` → header `chat` dot + mobile badge; `/messages` is `access:"student"` so guests hit the auth wall via `applyParsed`/returnTo. (Browser-confirm the returnTo round-trip.)
- [x] Deep-link to `/messages` works; tab title correct. — `router.js` ROUTES/BUILD + `titleFor` ("Messages · Nested NYC"); covered by `router.test.js`.

### Sprint 5 — Thread screen + send (optimistic)
**Deliverables:**
- `src/design/messageThread.jsx` (thread + composer).
- Router: `/messages/:id` + `messageThreadId` param state.
- NestedApp: open handler, **optimistic send** (client-generated `id`, append, reconcile/dedup on confirm), mark-read on open. "Message" entry points on people grid + `userProfile` (buttons: `people.jsx` ~130–136, `userProfile.jsx` ~85–92; seams #9).
**Acceptance:**
- [x] A and B exchange messages (manual refetch ok — realtime is S6). — `messageThread.jsx` (bubbles + composer) + the `get_thread` loader + `/messages/:username`.
- [x] Optimistic message appears instantly; reconciles on server confirm; failure reverts + toasts. — `sendThreadMessage` (pending row → `{...data, pending:false}` on confirm; revert + toast on error); reconcile-by-id in `messageAdapter.upsertMessage`/`mergeThread` (covered by `messageAdapter.test.js`). **Hardened 2026-06-23:** reconcile is now guarded by `openPeerIdRef` so a mid-send peer switch can't splice the bubble into the wrong thread.
- [x] Opening a thread clears its unread count. — `markThreadRead` + inbox-row zeroing on thread open.

### Sprint 6 — Realtime delivery + reconnect-resync
**Deliverables:**
- Second Realtime subscription in NestedApp — clone the `tm-self-<id>` block at `NestedApp.jsx:575–613` as `dm-self-<me>`: filter `recipient_id=eq.<me>`, INSERT → bump inbox/unread; if matching thread open, refetch since last-seen. (Seams #3.)
- **Reconnect/visibility resync:** on resubscribe-after-drop or tab focus, refetch open thread since last id + refresh inbox.
- Dedup live arrivals against optimistic copies via `id`.
**Acceptance:**
- [ ] Live delivery across two browsers within ~1s. — implemented (`dm-self` `postgres_changes` INSERT on `recipient_id=eq.<me>` → refetch); **transport/timing, so verify in a two-browser test.**
- [ ] Messages sent while a tab was disconnected appear after reconnect (no loss). — implemented (repeat-SUBSCRIBED + `visibilitychange` resync); **verify in the same two-browser test (disconnect a tab, send, reconnect).**
- [x] No duplicate bubbles for self-sent messages. — code-verified: the channel filters `recipient_id=eq.<me>` (self-sends never echo) and refetches dedup by id via `mergeThread`/`upsertMessage` (`messageAdapter.test.js`).

> S6 code is complete; the two transport/timing boxes above are the only items that genuinely require a live two-browser check before final sign-off.

### Sprint 7 — Trust & Safety + privacy hardening
**Status (2026-06-22):** Block/unblock UI + privacy hardening shipped — **block is DM-only** (locked decision: gates new DMs both ways, leaves the connection + profile, reversible). **Report deferred** to a later sprint; **"delete conversation" shipped in Sprint 8** (delete-for-me).
**Deliverables:**
- **Block/unblock UI** (DM-only): `messageService.getMyBlocks()` hydrates a `blocked` Set (mirrors `connected`); Block/Unblock from the **thread overflow menu** (with a blocked-composer "Unblock to message" bar) and from the **profile** (`PersonProfile`, covering the People grid + `/u/:username`). Confirm-on-block via `ConfirmModal`; optimistic + revert. New `block` / `ellipsis` icons.
- Rate-limit: **kept at 10 sends / 10s / sender**; abuse test added. *Best-effort:* the count-then-insert is non-atomic under READ COMMITTED, so a parallel burst can slightly exceed the cap (bounded — every row still needs a connection + no block + the real `auth.uid()`). Harden with a per-sender `pg_advisory_xact_lock` only if abuse warrants it.
- **Deletion**: account-deletion cascade **verified via SQL** (there is no in-app account-deletion feature — that's an auth-wide concern; S7 only proves DM rows cascade). In-app "delete conversation" (delete-for-me) → shipped in **S8**.
- **Don't-log-bodies** audit: **clean** (see below). **a11y + mobile** pass on both message screens (semantic conversation rows w/ keyboard open; aria-labels on thread controls/bubbles/badges; `:focus-visible` rings; 860px verified).
- ~~**Report** flow~~ → deferred.
- Tests: `supabase/tests/dm_s7_safety.sql` — block symmetry + unblock-restore, rate-limit, deletion cascade.

**Privacy, logging & retention (audited 2026-06-22):**
- Bodies are encrypted at rest (`pgp_sym_encrypt`, Vault key `dm_body_key`), decrypted only inside the SECURITY DEFINER RPCs — a raw `SELECT body_enc` or a Realtime payload is ciphertext.
- **No message body is logged anywhere:** the RPCs raise only keyed errors (`not_connected` / `blocked` / `rate_limited`), and `messageService` / `messageAdapter` log error objects, never bodies.
- **First-message email webhook on `messages`** (added 2026-06-28) — a per-row Supabase webhook on `messages` INSERT → `/api/notify`, throttled to the *first* message of a pair (`planNewMessage`: messages-table is-first check + `message_notify_log` dedupe + a 100/hr per-sender cap). The original bulk-email hazard was re-assessed as a non-issue: `messages` is written only one row at a time through the rate-limited `send_message` RPC (direct INSERT is `REVOKE`d), with no bulk/backfill path. Bodies are never read by the email path (sender-name-only). ⚠️ Disable the `notify_messages` webhook before any bulk `messages` INSERT/restore — see `EMAIL_NOTIFICATIONS.md`.
- **Retention:** messages persist until account deletion, then cascade away (`auth.users → profiles → messages + blocks`, all `ON DELETE CASCADE`).

**Acceptance:**
- [x] Prevents new DMs both directions + reversible; the blocked party can't tell (vague PT403). *Block is DM-only per the locked decision — it does not hide the blocker's profile.* — code + `dm_s7_safety.sql` T1.
- [ ] Report produces an actionable record. — **deferred** (Report not in this sprint).
- [x] Deleting an account removes its messages (cascade verified). — `dm_s7_safety.sql` T3.
- [x] No message body appears in any server log. — audited above; clean.

### Sprint 8 — Delete conversation (delete-for-me)
**Status (2026-06-23):** Built. **Locked decision:** delete is **delete-for-me only** — every message is one shared row read by both participants and *delete-for-everyone* is out of scope, so a hard delete is impossible without destroying the peer's copy. v1 is the familiar **"delete chat" clear watermark**: clearing hides the thread up to *now()* for the caller only; the peer is unaffected, and the thread reappears (with just the new messages) if they message again.
**Deliverables:**
- Migration `20260624000000_dm_delete_conversation.sql`: `conversation_clears(user_id, peer_id, cleared_at, PK(user_id,peer_id))` + self-scoped RLS (writes only via the RPC; `REVOKE INSERT/UPDATE/DELETE`); `delete_conversation(p_peer)` DEFINER RPC (upserts the watermark to `now()`, `PT401`/`PT422` guards); `CREATE OR REPLACE get_inbox`/`get_thread` to hide messages with `created_at <= cleared_at` **for the caller only** (encryption + paging + ordering unchanged).
- Service: `messageService.deleteConversation(peerId)`.
- UI: "Delete conversation" (danger) in the **thread overflow menu** beside Block, behind a `ConfirmModal`; optimistic inbox-row removal + leave-the-thread, revert-on-failure. New `trash` icon.
- Out of scope: per-message delete; deleting from the inbox list (overflow-menu-only for v1); **Report** (still a later sprint).
**Acceptance:**
- [x] Deleting a conversation removes it from the caller's inbox + thread; the peer still sees everything. — `supabase/tests/dm_s8_acceptance.sql` TEST 1–3.
- [x] A new message after a delete reappears for the caller (clear is a watermark, not a tombstone). — `dm_s8_acceptance.sql` TEST 5 (+ TEST 1 shows the post-watermark message).
- [x] `delete_conversation` is caller-scoped + idempotent; self-delete → PT422, unauthenticated → PT401. — `dm_s8_acceptance.sql` TEST 4/6.
- [x] Unread recomputes over only the still-visible messages. — `dm_s8_acceptance.sql` TEST 2.

> Code-complete & code-reviewed 2026-06-23. Re-run `dm_s8_acceptance.sql` on a local post-S3 Supabase for a machine-local PASS.

### Sprint 9 — Chat polish (status, receipts, pagination, dividers, retry, length cap)
**Status (2026-06-23):** Built + verified. The "essential chat things" gap-fill. Kept modular — each piece is a localized add (pure helpers in `messageAdapter`, a self-contained receipts channel).
**Deliverables:**
- **Delivery status** under the latest sent message: Sending… → Delivered → Seen (pure `messageStatus()` from the existing `pending`/`read_at`). **Always-on** read receipts.
- **Live "Seen" (+ a home for typing later):** a per-conversation Realtime **broadcast** channel (`dm-receipts:<sorted-pair>`) carries an ephemeral "read up to <t>" ping so the sender flips to Seen instantly — the `messages` publication stays INSERT-only; `read_at` remains the unread source of truth. Removing the block degrades Seen to "updates on next refetch", nothing breaks.
- **Load-older pagination** via `get_thread(p_since)` keyset; "Load earlier" control with scroll-anchoring (no jump).
- **Date dividers** (Today/Yesterday/date) via pure `dayKey`/`dayLabel`.
- **Failed-send retry**: a failed send stays as a red bubble with tap-to-retry (re-sends the same id — idempotent), instead of vanishing.
- **Body length cap (found gap):** `send_message` rejects > 4000 chars (PT422) + client guard + composer counter.
**Acceptance:**
- [x] Sender sees Sending/Delivered/Seen; recipient reading flips it live. — `messageStatus` (unit-tested) + the dm-receipts broadcast; live path is browser-verifiable.
- [x] Older messages load on demand without losing scroll position. — `loadEarlierThread` + `get_thread` keyset; scroll-anchor `useLayoutEffect`.
- [x] Day dividers + retry render correctly. — `dayKey`/`dayLabel`/`mergeThread`(failed) unit-tested (`messageAdapter.test.js`).
- [x] Over-length body rejected server-side. — `dm_chat_features_acceptance.sql` TEST 1.

### Sprint 10 — Attachments (documents + images)
**Status (2026-06-23):** Built + verified. **Modular**: a separate `message_attachments` table + the `dm-attachments` bucket + a `messageAttachments.jsx` UI module + the `send_message p_attachments` arg — removable as a unit.
**Privacy note (locked tradeoff):** message **bodies** are encrypted at rest (pgcrypto); **attachment blobs are NOT** — they live in a *private* Storage bucket gated by RLS (own-folder write, participant read) with short-lived signed-URL reads. Full at-rest blob encryption would require client-side crypto that fights preview/download; deferred. Orphaned blobs on message delete are left for a later cleanup job (rows cascade).
**Deliverables:**
- Bucket `dm-attachments` (private, **10 MB/file**, mime allowlist: images + pdf/office/text) + `storage.objects` RLS.
- `message_attachments` table (cascades with the message) + `send_message(p_attachments jsonb)` inserting them atomically; `get_thread` returns an `attachments` array; `get_inbox` returns `last_has_attachment`.
- Service: `uploadAttachment()` + signed-URL hydration; composer attach control (≤5 files, client size/type validation) + image/doc rendering.
**Acceptance:**
- [x] Send/receive image + document attachments; participant-only access. — `dm_chat_features_acceptance.sql` TEST 2b/3 + Storage RLS.
- [x] Attachment metadata persists, returns, and surfaces in inbox/thread. — TEST 3a/3b/3c, TEST 4.
- [x] Limits enforced (size/type by the bucket; ≤5 + length by the RPC). — TEST 1/5; bucket `file_size_limit`/`allowed_mime_types`.
- [x] Deleting a message/account cascades attachment rows. — TEST 6.

---

## Cross-cutting requirements (mapped to sprints)
- Idempotency keys → **S2** · Rate-limit → **S2** (tune S7) · Connection gate → **S1**+**S2**
- Block → **S1** (table/RLS) + **S2** (RPC) + **S7** (UI) · Report → *deferred* (later sprint)
- Ordering/dedup → **S5** · Reconnect-resync → **S6** · Encryption (Option B) → **S3**
- Don't-log-bodies → **S3**+**S7** · Account-deletion cascade → **S7** · Delete conversation (delete-for-me) → **S8**

## Out of scope (v1 / deferred)
- Group chats, edit/delete-for-everyone. ~~attachments/images~~ shipped in **S10**; ~~read receipts~~ shipped in **S9** (always-on Seen). Still deferred: **typing indicators** (the dm-receipts broadcast channel is the place to add them), **online/last-active presence**, and a **per-user read-receipt privacy toggle**.
- ~~**Message email notifications**~~ — **SHIPPED 2026-06-28** as the *first-message-only* build this anticipated (the "throttled" condition): a per-row Supabase webhook on `messages` INSERT → `/api/notify` (`planNewMessage`), which emails the recipient only when no earlier message exists for the unordered pair, deduped via `message_notify_log` and capped 100/hr per sender. The old "**Do NOT** add a per-row webhook on `messages`" rule was retired after re-assessing the bulk-email hazard as a non-issue (`messages` is RPC-only, single-row, rate-limited; no bulk/backfill path). The webhook is still applied **out-of-band** (dashboard), and must be **disabled before any bulk `messages` op**. Still deferred: **offline-only** delivery (email only when the recipient is inactive) — a future layer on top of first-message-only.
- App-server write-path; message-requests gating; E2EE.

## Open questions
1. ~~Confirm gating = connection-gated~~ **Resolved 2026-06-21:** connection-gated, either-direction edge. (Alt: message-requests — deferred to v2.)
2. Rate-limit threshold — **deferred to S2** (set the concrete `~N messages/min/user` value there).
3. **Resolved** — `feat/header-dropdowns` merged to `main` (909dff3, live on prod 2026-06-21), so the S4 header-badge dependency is satisfied. Branch DM work off `main`.
