/* ============================================================
   NESTED NYC — Message adapter (Supabase ⇄ DM UI)

   Pure transforms between the DM RPC rows (send_message / get_thread / get_inbox
   return plaintext `body`; encryption is S3 and stays server-side) and the shape
   the chat UI (S4) renders. No service / supabase imports — mirrors
   projectAdapter.js. `myId` is the caller's auth uid, threaded in by
   messageService so "is this from me?" is decided here, not in the component.
   ============================================================ */

// One message row (from send_message / get_thread) → a chat bubble shape.
// `peerId` is always the OTHER party, so a thread component can key on it
// regardless of direction; `fromMe` drives left/right alignment.
export function fromDbMessage(row, myId) {
  if (!row) return null;
  const fromMe = row.sender_id === myId;
  return {
    id: row.id,
    peerId: fromMe ? row.recipient_id : row.sender_id,
    fromMe,
    body: row.body || "",
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}

// One inbox row (from get_inbox) → a conversation-list shape. `peer_id` is
// already the other party; `lastFromMe` lets the list render "You: …" prefixes,
// and `unreadCount` comes back as a bigint-string from PostgREST, so coerce it.
export function fromDbInboxRow(row, myId) {
  if (!row) return null;
  return {
    peerId: row.peer_id,
    lastBody: row.last_body || "",
    lastAt: row.last_at,
    lastFromMe: row.last_sender === myId,
    unreadCount: Number(row.unread_count) || 0,
  };
}

// Outbound: the chat composer's raw text → the RPC body payload. Trim here so
// the same rule (no leading/trailing whitespace; emptiness caught by the caller)
// applies on every send path.
export function toDbMessage(body) {
  return { body: (body || "").trim() };
}
