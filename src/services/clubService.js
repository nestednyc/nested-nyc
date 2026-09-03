/**
 * Club Service
 * Supabase data access for club membership: a student applies to an org
 * (answers the club's questions), the org's owner accepts or rejects, and
 * accepted rows are the public roster. Writes go through the SECURITY
 * DEFINER RPCs from migration 20260902000000 (apply_to_org /
 * decide_org_membership); the only direct DML is the self-only DELETE
 * (withdraw / leave). All methods return { data, error } and never throw.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { personLabel, bareHandle } from '../design/data'

const notConfigured = { message: 'Supabase not configured' }
const ROSTER_MAX = 200

// Friendly copy for the write-path SQLSTATEs the RPCs raise.
export function clubErrorMessage(error, fallback) {
  if (!error) return fallback
  if (error.code === 'PT429') return "Easy there — you're sending applications too fast. Give it an hour."
  if (error.code === 'PT403') return error.message && /run this org/.test(error.message)
    ? "That's your own org."
    : "This org doesn't take members."
  if (error.code === 'PT409') return 'That application was already reviewed.'
  if (error.code === 'PT422') return error.message || 'Please answer the required questions.'
  return (error && error.message) || fallback
}

async function attachPeople(rows, idOf) {
  const ids = [...new Set((rows || []).map(idOf).filter(Boolean))]
  if (!ids.length) return new Map()
  const { data } = await supabase
    .from('public_profiles')
    .select('id, first_name, last_name, username, avatar, university')
    .in('id', ids)
  return new Map((data || []).map((p) => [p.id, p]))
}

function person(p) {
  return {
    name: personLabel(p || {}, 'Student'),
    handle: bareHandle(p && p.username),
    avatar: (p && p.avatar) || null,
    uni: (p && p.university) || null,
  }
}

export const clubService = {
  /**
   * Apply to join an org. `answers` = { [questionId]: string | string[] }.
   * Returns { id, status, answers } — an existing pending/accepted row comes
   * back as-is; a rejected one is re-opened with the new answers.
   */
  async applyToOrg(orgId, answers) {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const { data, error } = await supabase.rpc('apply_to_org', { p_org: orgId, p_answers: answers || {} })
    return { data: data || null, error }
  },

  /** Owner only: accept (true) or reject (false) one pending application. */
  async decideMembership(id, accept) {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const { data, error } = await supabase.rpc('decide_org_membership', { p_id: id, p_accept: !!accept })
    return { data: data || null, error }
  },

  /** Withdraw a pending application or leave a club (own row only — RLS). */
  async leaveOrg(orgId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase
      .from('org_memberships').delete().eq('org_id', orgId).eq('user_id', userId)
    return { error }
  },

  /** My rows across every org: [{ id, orgId, status }]. */
  async getMyMemberships(userId) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase
      .from('org_memberships')
      .select('id, org_id, status')
      .eq('user_id', userId)
    return { data: (data || []).map((r) => ({ id: r.id, orgId: r.org_id, status: r.status })), error }
  },

  /**
   * Clubs a student belongs to (accepted only), with the org for the
   * profile's "Clubs" line: [{ id, slug, name, logo, verified, student_run,
   * owner_user_id }] (the flags drive the tick / "student-run" mark). Public read.
   */
  async getMembershipsOf(userId) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase
      .from('org_memberships')
      .select('org:organizations(id, slug, name, logo, verified, student_run, owner_user_id)')
      .eq('user_id', userId)
      .eq('status', 'accepted')
    const orgs = (data || []).map((r) => r.org).filter((o) => o && o.id)
    return { data: orgs, error }
  },

  /** Public roster: accepted members, newest first. Rows: { userId, name, handle, avatar, uni, joinedAt }. */
  async getOrgMembers(orgId) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data: rows, error } = await supabase
      .from('org_memberships')
      .select('user_id, decided_at')
      .eq('org_id', orgId)
      .eq('status', 'accepted')
      .order('decided_at', { ascending: false })
      .limit(ROSTER_MAX)
    if (error) return { data: [], error }
    const people = await attachPeople(rows, (r) => r.user_id)
    return {
      data: (rows || []).map((r) => ({ userId: r.user_id, joinedAt: r.decided_at, ...person(people.get(r.user_id)) })),
      error: null,
    }
  },

  /** "N members" (SECURITY DEFINER count). */
  async getOrgMemberCount(orgId) {
    if (!isSupabaseConfigured()) return { data: 0, error: notConfigured }
    const { data, error } = await supabase.rpc('org_member_count', { p_org: orgId })
    return { data: typeof data === 'number' ? data : 0, error }
  },

  /**
   * Owner view: every application for the org (pending, accepted, rejected),
   * newest first. Rows: { id, userId, name, handle, avatar, uni, status,
   * requestedAt, decidedAt, answers }.
   */
  async getOrgApplicants(orgId) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data: rows, error } = await supabase
      .from('org_memberships')
      .select('id, user_id, status, answers, requested_at, decided_at')
      .eq('org_id', orgId)
      .order('requested_at', { ascending: false })
    if (error) return { data: [], error }
    const people = await attachPeople(rows, (r) => r.user_id)
    return {
      data: (rows || []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        requestedAt: r.requested_at,
        decidedAt: r.decided_at,
        answers: r.answers || {},
        ...person(people.get(r.user_id)),
      })),
      error: null,
    }
  },
}

export default clubService
