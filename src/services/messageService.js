/**
 * Message Service
 * 1:1 student↔student direct messages, behind the S2 SECURITY DEFINER RPCs
 * (send_message / get_inbox / get_thread / mark_thread_read / block_user /
 * unblock_user). The RPC is the ONLY write path — direct INSERT on messages was
 * REVOKEd in 20260622000000 — so rate-limit + idempotency can't be bypassed.
 *
 * Like every service here: isSupabaseConfigured() early return, getUser() guard,
 * ALWAYS returns { data, error }, NEVER throws (the RPC call is try/caught).
 * RPC errors are mapped by error.code — the PostgREST HTTP-status SQLSTATE
 * (PT401 / PT403 / PT429 / PT422) — into a friendly message, never by sniffing
 * error.message strings.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fromDbMessage, fromDbInboxRow, toDbMessage } from '../design/messageAdapter'

// ── Limits (mirrored server-side) ───────────────────────────────────────────
// Body length cap — enforced in the send_message RPC too (PT422). Keeps a single
// runaway paste from minting a multi-MB encrypted row.
export const MAX_MESSAGE_CHARS = 4000;
// Attachment limits — mirrored by the dm-attachments Storage bucket
// (file_size_limit + allowed_mime_types) and re-checked in the RPC.
export const MAX_ATTACH_BYTES = 10 * 1024 * 1024;   // 10 MB / file
export const MAX_ATTACH_COUNT = 5;                  // per message
export const ALLOWED_ATTACH_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
];
const ATTACH_BUCKET = 'dm-attachments';
const SIGNED_URL_TTL = 60 * 60;   // 1h signed URLs for private-bucket reads

// Batch-sign the Storage paths on a list of UI messages so attachments render
// from a private bucket. Best-effort: a signing failure leaves url=null (the UI
// shows the file as a non-clickable chip rather than breaking the thread).
async function signAttachmentsOn(messages) {
  if (!supabase) return messages;
  const paths = [];
  for (const m of messages) for (const a of (m.attachments || [])) if (a.path) paths.push(a.path);
  if (!paths.length) return messages;
  let byPath = new Map();
  try {
    const { data } = await supabase.storage.from(ATTACH_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    byPath = new Map((data || []).filter((s) => s && !s.error).map((s) => [s.path, s.signedUrl]));
  } catch (err) { console.error('signAttachments exception:', err); }
  return messages.map((m) => (m.attachments && m.attachments.length)
    ? { ...m, attachments: m.attachments.map((a) => ({ ...a, url: byPath.get(a.path) || null })) }
    : m);
}

// Generic client-side idempotency key for a send. The DB PK (messages.id) is the
// real dedupe; this just gives a retried send the SAME id so it lands on the
// idempotency branch instead of minting a new row.
export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // RFC-4122 v4 fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// SQLSTATE (error.code from PostgREST) → user-facing copy. The "blocked" case is
// deliberately vague: a 403/blocked and a 403/not_connected must not be
// distinguishable to the sender, so a blocked send reads as a generic failure.
function messageForError(error) {
  if (!error) return null
  switch (error.code) {
    case 'PT401':
      return 'Please sign in to send messages'
    case 'PT403':
      // not_connected is the only actionable 403 we surface specifically;
      // "blocked" stays vague (don't reveal a block to the blocked party).
      return error.message === 'not_connected'
        ? "You can only message people you're connected to"
        : 'Unable to send message'
    case 'PT429':
      return "You're sending messages too fast — slow down a moment"
    case 'PT422':
      return "You can't message yourself"
    case 'PT500':
      // Server-side infra fault (e.g. the Vault key missing). Never surface the
      // raw internal message — it can name secrets/infrastructure.
      return 'Messages are temporarily unavailable — please try again later'
    default:
      // Any other SQLSTATE: do NOT echo the raw Postgres/PostgREST text to the
      // user (it can leak internals). Log it for diagnostics, show a generic line.
      if (error.code) console.error('Unmapped DM RPC error:', error.code, error.message)
      return 'Something went wrong — please try again'
  }
}

export const messageService = {
  /**
   * Send a message to a connection. Idempotent on the client-supplied id, so a
   * retry of the same logical send returns the original row instead of
   * duplicating. Returns the stored message in UI shape.
   * @param {string} recipientId
   * @param {string} body
   * @param {string} [id] - idempotency key; auto-generated if omitted
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async sendMessage(recipientId, body, id = newId(), attachments = []) {
    if (!isSupabaseConfigured() || !supabase) return { data: null, error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: { message: 'Not authenticated' } }

    const trimmed = toDbMessage(body).body
    const atts = Array.isArray(attachments) ? attachments : []
    // A message needs text OR at least one attachment.
    if (!trimmed && !atts.length) return { data: null, error: { message: 'Message is empty' } }
    if (trimmed.length > MAX_MESSAGE_CHARS) return { data: null, error: { message: 'Message is too long (max ' + MAX_MESSAGE_CHARS + ' characters)' } }

    try {
      const { data, error } = await supabase.rpc('send_message', {
        p_id: id,
        p_recipient: recipientId,
        p_body: trimmed,
        p_attachments: atts,   // [] when none; the RPC defaults it too for older callers
      })
      if (error) {
        return { data: null, error: { ...error, message: messageForError(error) } }
      }
      // send_message RETURNS a SETOF row → take the single row, then sign any
      // attachment URLs so the confirmed bubble renders immediately.
      const row = Array.isArray(data) ? data[0] : data
      const [ui] = await signAttachmentsOn([fromDbMessage(row, user.id)])
      return { data: ui, error: null }
    } catch (err) {
      console.error('sendMessage exception:', err)
      return { data: null, error: { message: 'Unable to send message' } }
    }
  },

  /**
   * Upload one attachment to the private dm-attachments bucket under
   * <uid>/<messageId>/<safe-name> (own-folder write per Storage RLS). Returns the
   * metadata send_message expects. Validated client-side here AND by the bucket.
   * @param {File} file
   * @param {string} messageId - the client-supplied message id this will attach to
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async uploadAttachment(file, messageId) {
    if (!isSupabaseConfigured() || !supabase) return { data: null, error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: { message: 'Not authenticated' } }
    if (!file) return { data: null, error: { message: 'No file' } }
    if (file.size > MAX_ATTACH_BYTES) return { data: null, error: { message: 'File too large (max 10 MB)' } }
    if (file.type && !ALLOWED_ATTACH_MIME.includes(file.type)) return { data: null, error: { message: 'File type not supported' } }

    const safe = (file.name || 'file').replace(/[^\w.\- ]+/g, '_').slice(-100)
    const path = user.id + '/' + messageId + '/' + safe
    try {
      const { error } = await supabase.storage.from(ATTACH_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (error) { console.error('uploadAttachment error:', error); return { data: null, error: { message: 'Upload failed — ' + (error.message || 'try again') } } }
      return { data: { storage_path: path, mime_type: file.type || 'application/octet-stream', size_bytes: file.size, file_name: file.name || safe }, error: null }
    } catch (err) {
      console.error('uploadAttachment exception:', err)
      return { data: null, error: { message: 'Upload failed' } }
    }
  },

  /**
   * The caller's conversation list: latest message + unread count per peer,
   * newest thread first.
   * @returns {Promise<{data: array, error: object|null}>}
   */
  async getInbox() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    try {
      const { data, error } = await supabase.rpc('get_inbox')
      if (error) {
        console.error('getInbox error:', error)
        return { data: [], error: { ...error, message: messageForError(error) } }
      }
      return { data: (data || []).map((r) => fromDbInboxRow(r, user.id)), error: null }
    } catch (err) {
      console.error('getInbox exception:', err)
      return { data: [], error: { message: 'Unable to load messages' } }
    }
  },

  /**
   * One thread: both directions between the caller and peerId, newest first.
   * @param {string} peerId
   * @param {string|null} [since] - ISO timestamp; returns messages OLDER than this (paging)
   * @param {number} [limit] - capped at 100 server-side
   * @returns {Promise<{data: array, error: object|null}>}
   */
  async getThread(peerId, since = null, limit = 50) {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    try {
      const { data, error } = await supabase.rpc('get_thread', {
        p_peer: peerId,
        p_since: since,
        p_limit: limit,
      })
      if (error) {
        console.error('getThread error:', error)
        return { data: [], error: { ...error, message: messageForError(error) } }
      }
      return { data: await signAttachmentsOn((data || []).map((r) => fromDbMessage(r, user.id))), error: null }
    } catch (err) {
      console.error('getThread exception:', err)
      return { data: [], error: { message: 'Unable to load conversation' } }
    }
  },

  /**
   * Mark every unread message from peerId (to the caller) as read.
   * @param {string} peerId
   * @returns {Promise<{error: object|null}>}
   */
  async markThreadRead(peerId) {
    if (!isSupabaseConfigured() || !supabase) return { error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'Not authenticated' } }

    try {
      const { error } = await supabase.rpc('mark_thread_read', { p_peer: peerId })
      if (error) return { error: { ...error, message: messageForError(error) } }
      return { error: null }
    } catch (err) {
      console.error('markThreadRead exception:', err)
      return { error: { message: 'Unable to update messages' } }
    }
  },

  /**
   * Block a user. Idempotent; does not sever the connection (v1).
   * @param {string} targetId
   * @returns {Promise<{error: object|null}>}
   */
  async blockUser(targetId) {
    if (!isSupabaseConfigured() || !supabase) return { error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'Not authenticated' } }

    try {
      const { error } = await supabase.rpc('block_user', { p_target: targetId })
      if (error) return { error: { ...error, message: messageForError(error) } }
      return { error: null }
    } catch (err) {
      console.error('blockUser exception:', err)
      return { error: { message: 'Unable to block user' } }
    }
  },

  /**
   * Unblock a user. Idempotent.
   * @param {string} targetId
   * @returns {Promise<{error: object|null}>}
   */
  async unblockUser(targetId) {
    if (!isSupabaseConfigured() || !supabase) return { error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'Not authenticated' } }

    try {
      const { error } = await supabase.rpc('unblock_user', { p_target: targetId })
      if (error) return { error: { ...error, message: messageForError(error) } }
      return { error: null }
    } catch (err) {
      console.error('unblockUser exception:', err)
      return { error: { message: 'Unable to unblock user' } }
    }
  },

  /**
   * Delete a conversation for the caller only (S8). Sets a per-user clear
   * watermark to now() via the delete_conversation RPC, so this thread leaves
   * the caller's inbox and get_thread; the peer is unaffected and the thread
   * reappears if they message again. Idempotent (re-clearing bumps the mark).
   * @param {string} peerId
   * @returns {Promise<{error: object|null}>}
   */
  async deleteConversation(peerId) {
    if (!isSupabaseConfigured() || !supabase) return { error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'Not authenticated' } }

    try {
      const { error } = await supabase.rpc('delete_conversation', { p_peer: peerId })
      if (error) return { error: { ...error, message: messageForError(error) } }
      return { error: null }
    } catch (err) {
      console.error('deleteConversation exception:', err)
      return { error: { message: 'Unable to delete conversation' } }
    }
  },

  /**
   * The peer ids the caller has blocked. A direct RLS-scoped read — the "View
   * own blocks" policy already restricts the table to blocker_id = auth.uid() —
   * so no RPC is needed (mirrors connectionService.getMyConnections). Loaded at
   * hydration into a Set so any surface can render Block vs Unblock; only the
   * caller's OWN blocks are ever exposed (never "who blocked me").
   * @returns {Promise<{data: string[], error: object|null}>}
   */
  async getMyBlocks() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    try {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)
      if (error) {
        console.error('getMyBlocks error:', error)
        return { data: [], error }
      }
      return { data: (data || []).map((r) => r.blocked_id).filter(Boolean), error: null }
    } catch (err) {
      console.error('getMyBlocks exception:', err)
      return { data: [], error: { message: 'Unable to load blocks' } }
    }
  },
}

export default messageService
