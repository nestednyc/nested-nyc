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

// Generic client-side idempotency key for a send. The DB PK (messages.id) is the
// real dedupe; this just gives a retried send the SAME id so it lands on the
// idempotency branch instead of minting a new row.
function newId() {
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
    default:
      return error.message || 'Something went wrong'
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
  async sendMessage(recipientId, body, id = newId()) {
    if (!isSupabaseConfigured() || !supabase) return { data: null, error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: { message: 'Not authenticated' } }

    const trimmed = toDbMessage(body).body
    if (!trimmed) return { data: null, error: { message: 'Message is empty' } }

    try {
      const { data, error } = await supabase.rpc('send_message', {
        p_id: id,
        p_recipient: recipientId,
        p_body: trimmed,
      })
      if (error) {
        return { data: null, error: { ...error, message: messageForError(error) } }
      }
      // send_message RETURNS a SETOF row → take the single row.
      const row = Array.isArray(data) ? data[0] : data
      return { data: fromDbMessage(row, user.id), error: null }
    } catch (err) {
      console.error('sendMessage exception:', err)
      return { data: null, error: { message: 'Unable to send message' } }
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
      return { data: (data || []).map((r) => fromDbMessage(r, user.id)), error: null }
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
}

export default messageService
