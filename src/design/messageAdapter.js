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

// Compact "time since" for a conversation's last message: just now → Nm → Nh →
// Nd, then a short en-US date once it's a week old. A pure UI-shape transform of
// a timestamp, kept with the other DM transforms so the inbox screen stays
// presentational and this stays unit-testable. (Live clock is fine in app code.)
export function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + "d";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Join inbox rows (fromDbInboxRow shape: { peerId, lastBody, lastAt, lastFromMe,
// unreadCount }) with the loaded People list to attach each peer's display
// identity. Order is preserved (get_inbox already returns newest-first); a peer
// absent from `people` falls back to a generic name + initials avatar. Pure (no
// service/supabase imports), so the inbox screen receives render-ready rows.
export function enrichConversations(inbox, people) {
  const byId = new Map((people || []).map((p) => [p.id, p]));
  return (inbox || []).map((r) => {
    const peer = byId.get(r.peerId);
    return {
      ...r,
      name: (peer && peer.name) || "Student",
      avatar: (peer && peer.avatar) || null,
      handle: (peer && peer.handle) || null,
    };
  });
}

// Insert-or-replace a message in a thread list by id: replace in place when an
// entry with the same id already exists (optimistic row → confirmed row on send;
// later, a realtime arrival deduping a self-echo), else append. Pure — callers
// keep the list chronological (oldest→newest), so a fresh append lands last.
export function upsertMessage(list, msg) {
  if (!msg) return list || [];
  const arr = list || [];
  const i = arr.findIndex((m) => m.id === msg.id);
  if (i === -1) return [...arr, msg];
  const next = arr.slice();
  next[i] = msg;
  return next;
}

// Union a freshly-fetched thread (chronological) into the current one — the S6
// realtime/resync path: a ping or a reconnect refetches the latest ~50 via the
// decrypting RPC, and this folds them in. Dedups by id (so a self-sent message
// the refetch echoes collapses against its optimistic/confirmed copy), then
// keeps confirmed messages sorted by server time. Pending optimistic sends are
// PINNED LAST and left in insertion order: they carry a client clock, so sorting
// them in would make the bubble hop when the server's (smaller) created_at lands
// on confirm. Pure + order-independent: it doesn't matter whether the initial
// load or a realtime refetch resolves first — both merge to the same result.
export function mergeThread(existing, fetchedChrono) {
  let merged = (existing || []).slice();
  for (const m of (fetchedChrono || [])) merged = upsertMessage(merged, m);
  const cmp = (a, b) => (             // ISO-8601 Z timestamps: lexical order == chronological
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0   // stable id tiebreak for equal timestamps
  );
  const confirmed = merged.filter((m) => !m.pending).sort(cmp);
  const pending = merged.filter((m) => m.pending);   // insertion order, always last
  return [...confirmed, ...pending];
}

// Update-or-insert a peer's inbox row from a single thread message, keeping the
// list newest-first (same ordering get_inbox returns). `read` true zeroes the
// unread count — used by the optimistic send path (you sent it) and the realtime
// open-thread refetch (you're reading it). The read:false increment branch is a
// general capability (the not-open realtime path refreshes the whole inbox via
// get_inbox instead). Pure; replaces the inline idiom send used before so the
// send and realtime paths stay in sync.
export function bumpInboxRow(rows, peerId, { lastBody, lastAt, lastFromMe, read }) {
  let seen = false;
  let next = (rows || []).map((r) => {
    if (r.peerId !== peerId) return r;
    seen = true;
    return { ...r, lastBody, lastAt, lastFromMe, unreadCount: read ? 0 : (r.unreadCount || 0) + 1 };
  });
  if (!seen) next = [{ peerId, lastBody, lastAt, lastFromMe, unreadCount: read ? 0 : 1 }, ...next];
  return next.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}
