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
```

**RPC surface (the stable client contract):**
`send_message(p_id, p_recipient, p_body)` · `get_inbox()` · `get_thread(p_peer, p_since, p_limit)` · `mark_thread_read(p_peer)` · `block_user(p_target)` / `unblock_user(p_target)` · `get_my_blocks` (S7, client-side via RLS select) · `report_user(...)` (planned — deferred)

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
- [ ] Send/list/read/block all work from a console/scratch harness against local Supabase.
- [ ] Re-sending the same `p_id` does **not** create a duplicate (idempotency).
- [ ] Exceeding the rate limit is rejected with a clear error.
- [ ] Service returns `{data,error}` and never throws.

### Sprint 3 — Option B: encryption at rest
**Goal:** bodies are ciphertext at rest; authorized reads return plaintext; client/service untouched.
**Deliverables:**
- Vault secret holding the symmetric key (read via `vault.decrypted_secrets` inside the DEFINER RPCs). **Vault is not in `supabase/migrations/` today** — create the secret out-of-band (Supabase dashboard, or Management API `/database/query` with an `sbp_` PAT) and record the key *name/id* here, never the key itself.
- Swap RPC internals to `pgp_sym_encrypt`/`pgp_sym_decrypt`. (Dev: truncate test rows; prod has none.)
- Confirm no plaintext bodies in logs / error messages.
**Acceptance:**
- [ ] A raw `SELECT body_enc FROM messages` returns ciphertext bytes.
- [ ] `get_thread` returns correct plaintext to a participant.
- [ ] The realtime→refetch path returns decrypted text (verified in S6).
- [ ] No code change required in `messageService.js`.

### Sprint 4 — Inbox screen + routing + header badge
**Deliverables:**
- `src/design/messages.jsx` (presentational conversation list, cork-board styled, 860px mobile).
- Router: ROUTES/BUILD/titleFor for `/messages` (`access:"student"`).
- NestedApp: `inbox`/`unreadCount` state, `get_inbox()` in hydration, conditional render, **header "Messages" icon + unread dot**. (`feat/header-dropdowns` has merged to `main` — 909dff3 — so this is unblocked. Render the `chat` icon + `.dot` inline at `NestedApp.jsx:1675–1698`; add a `MessagesPanel` to `headerMenus.jsx` mirroring `NotifPanel`; mirror it into the mobile account sheet 1905–1924. See seams #5.)
**Acceptance:**
- [ ] Signed-in user sees their conversations + unread badge; guest is gated (returnTo stash).
- [ ] Deep-link to `/messages` works; tab title correct.

### Sprint 5 — Thread screen + send (optimistic)
**Deliverables:**
- `src/design/messageThread.jsx` (thread + composer).
- Router: `/messages/:id` + `messageThreadId` param state.
- NestedApp: open handler, **optimistic send** (client-generated `id`, append, reconcile/dedup on confirm), mark-read on open. "Message" entry points on people grid + `userProfile` (buttons: `people.jsx` ~130–136, `userProfile.jsx` ~85–92; seams #9).
**Acceptance:**
- [ ] A and B exchange messages (manual refetch ok — realtime is S6).
- [ ] Optimistic message appears instantly; reconciles on server confirm; failure reverts + toasts.
- [ ] Opening a thread clears its unread count.

### Sprint 6 — Realtime delivery + reconnect-resync
**Deliverables:**
- Second Realtime subscription in NestedApp — clone the `tm-self-<id>` block at `NestedApp.jsx:575–613` as `dm-self-<me>`: filter `recipient_id=eq.<me>`, INSERT → bump inbox/unread; if matching thread open, refetch since last-seen. (Seams #3.)
- **Reconnect/visibility resync:** on resubscribe-after-drop or tab focus, refetch open thread since last id + refresh inbox.
- Dedup live arrivals against optimistic copies via `id`.
**Acceptance:**
- [ ] Live delivery across two browsers within ~1s.
- [ ] Messages sent while a tab was disconnected appear after reconnect (no loss).
- [ ] No duplicate bubbles for self-sent messages.

### Sprint 7 — Trust & Safety + privacy hardening
**Status (2026-06-22):** Block/unblock UI + privacy hardening shipped — **block is DM-only** (locked decision: gates new DMs both ways, leaves the connection + profile, reversible). **Report deferred** to a later sprint; **"delete conversation" deferred to Sprint 8.**
**Deliverables:**
- **Block/unblock UI** (DM-only): `messageService.getMyBlocks()` hydrates a `blocked` Set (mirrors `connected`); Block/Unblock from the **thread overflow menu** (with a blocked-composer "Unblock to message" bar) and from the **profile** (`PersonProfile`, covering the People grid + `/u/:username`). Confirm-on-block via `ConfirmModal`; optimistic + revert. New `block` / `ellipsis` icons.
- Rate-limit: **kept at 10 sends / 10s / sender**; abuse test added.
- **Deletion**: account-deletion cascade **verified via SQL** (there is no in-app account-deletion feature — that's an auth-wide concern; S7 only proves DM rows cascade). "Delete conversation" → S8.
- **Don't-log-bodies** audit: **clean** (see below). **a11y + mobile** pass on both message screens (semantic conversation rows w/ keyboard open; aria-labels on thread controls/bubbles/badges; `:focus-visible` rings; 860px verified).
- ~~**Report** flow~~ → deferred.
- Tests: `supabase/tests/dm_s7_safety.sql` — block symmetry + unblock-restore, rate-limit, deletion cascade.

**Privacy, logging & retention (audited 2026-06-22):**
- Bodies are encrypted at rest (`pgp_sym_encrypt`, Vault key `dm_body_key`), decrypted only inside the SECURITY DEFINER RPCs — a raw `SELECT body_enc` or a Realtime payload is ciphertext.
- **No message body is logged anywhere:** the RPCs raise only keyed errors (`not_connected` / `blocked` / `rate_limited`), and `messageService` / `messageAdapter` log error objects, never bodies.
- **No database webhook/trigger on `messages`** — the bulk-email hazard (`EMAIL_NOTIFICATIONS.md`) is avoided by construction.
- **Retention:** messages persist until account deletion, then cascade away (`auth.users → profiles → messages + blocks`, all `ON DELETE CASCADE`).

**Acceptance:**
- [x] Prevents new DMs both directions + reversible; the blocked party can't tell (vague PT403). *Block is DM-only per the locked decision — it does not hide the blocker's profile.* — code + `dm_s7_safety.sql` T1.
- [ ] Report produces an actionable record. — **deferred** (Report not in this sprint).
- [x] Deleting an account removes its messages (cascade verified). — `dm_s7_safety.sql` T3.
- [x] No message body appears in any server log. — audited above; clean.

---

## Cross-cutting requirements (mapped to sprints)
- Idempotency keys → **S2** · Rate-limit → **S2** (tune S7) · Connection gate → **S1**+**S2**
- Block → **S1** (table/RLS) + **S2** (RPC) + **S7** (UI) · Report → **S7**
- Ordering/dedup → **S5** · Reconnect-resync → **S6** · Encryption (Option B) → **S3**
- Don't-log-bodies → **S3**+**S7** · Deletion/retention → **S7**

## Out of scope (v1 / deferred)
- Group chats, attachments/images, typing indicators, edit/delete-for-everyone, read receipts beyond unread counts.
- **Message email notifications** — deferred *and* must be throttled/offline-only when built. **Do NOT** add a per-row email webhook on `messages` (bulk-email + spam hazard; see `EMAIL_NOTIFICATIONS.md`). The webhook/trigger layer (`zz_email_notify` etc.) is applied **out-of-band**, not in `supabase/migrations/`; none references `messages` today, and "do not add" means at the Supabase dashboard / prod-SQL level.
- App-server write-path; message-requests gating; E2EE.

## Open questions
1. ~~Confirm gating = connection-gated~~ **Resolved 2026-06-21:** connection-gated, either-direction edge. (Alt: message-requests — deferred to v2.)
2. Rate-limit threshold — **deferred to S2** (set the concrete `~N messages/min/user` value there).
3. **Resolved** — `feat/header-dropdowns` merged to `main` (909dff3, live on prod 2026-06-21), so the S4 header-badge dependency is satisfied. Branch DM work off `main`.
