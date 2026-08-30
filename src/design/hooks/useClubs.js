/* ============================================================
   useClubs — club membership, both sides of it.
   Student: my applications/memberships per org ({ orgId → { id,
   status } }), the "Join" flow (guest gate → answer sheet → RPC),
   withdraw/leave, and a realtime channel so the page flips to
   "Member" the moment the club decides. Org owner: the applicant
   list for their org, accept/reject (optimistic), member count.

   Domain-hook pattern: NestedApp stays the composition root. Follows
   are useCommunity's — accepting auto-follows in the DB, and the
   injected markFollowed(orgId) mirrors that client-side (hooks never
   import each other). resetClubs() is this domain's slice of
   signOut's wipe.
   ============================================================ */
import React from 'react'
import { supabase, isSupabaseConfigured, authService } from '../../lib/supabase'
import { clubService, clubErrorMessage } from '../../services/clubService'

const { useState, useRef, useEffect } = React;

export function useClubs({ profile, orgAccount, toast, requireAuth, markFollowed }) {
  // ---- student ----
  const [memberships, setMemberships] = useState({});   // orgId → { id, status }
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const loadRef = useRef(false);                          // getMyMemberships in flight / done
  const [myClubs, setMyClubs] = useState([]);              // accepted orgs: [{ id, slug, name, logo }]
  const [applyPrompt, setApplyPrompt] = useState(null);   // { org } | null
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyError, setApplyError] = useState(null);
  // ---- org owner ----
  const [applicants, setApplicants] = useState({ rows: [], loading: false, error: null, loaded: false });
  const [orgMemberCount, setOrgMemberCount] = useState(null);

  const setStatus = (orgId, next) => setMemberships((m) => {
    const n = { ...m };
    if (next) n[orgId] = { ...(m[orgId] || {}), ...next }; else delete n[orgId];
    return n;
  });

  // My rows, once per session (the club page, the board's org posts, and
  // the profile's Clubs line all read from this).
  async function ensureMemberships() {
    if (!profile || loadRef.current || !isSupabaseConfigured()) return;
    loadRef.current = true;
    const [{ data, error }, { data: clubs }] = await Promise.all([
      clubService.getMyMemberships(profile.id),
      clubService.getMembershipsOf(profile.id),
    ]);
    if (error) { loadRef.current = false; return; }
    setMemberships(Object.fromEntries((data || []).map((r) => [r.orgId, { id: r.id, status: r.status }])));
    setMyClubs(clubs || []);
    setMembershipsLoaded(true);
  }

  // The club decided (or I applied on another device) — keep this tab live.
  useEffect(() => {
    if (!profile || !profile.id || !isSupabaseConfigured() || !supabase) return;
    let channel;
    let cancelled = false;
    (async () => {
      const { data } = await authService.getSession();
      if (cancelled) return;
      const token = data && data.session && data.session.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;
      channel = supabase
        .channel("om-self-" + profile.id)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "org_memberships",
          filter: "user_id=eq." + profile.id,
        }, (payload) => {
          const row = (payload.new && payload.new.org_id) ? payload.new : payload.old;
          const orgId = row && row.org_id;
          if (!orgId) return;
          if (payload.eventType === "DELETE") { setStatus(orgId, null); return; }
          const status = payload.new && payload.new.status;
          setStatus(orgId, { id: payload.new.id, status });
          if (status === "accepted") {
            markFollowed && markFollowed(orgId);
            // Refresh the profile's Clubs line with the org row.
            clubService.getMembershipsOf(profile.id).then(({ data: clubs }) => { if (clubs) setMyClubs(clubs); });
            toast("You're in — a club accepted your application", "check");
          } else if (status === "rejected") {
            setMyClubs((c) => c.filter((o) => o.id !== orgId));
          }
        })
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [profile && profile.id]);

  // "Join": guests get the auth wall, pending/accepted get a nudge, clubs
  // with no questions apply straight away, the rest open the answer sheet.
  async function requestJoin(org) {
    if (!profile) return requireAuth("Sign in to join clubs");
    if (!org || !org.id) return;
    const cur = memberships[org.id];
    if (cur && cur.status === "pending") { toast("Your application is with " + org.name, "clock"); return; }
    if (cur && cur.status === "accepted") { toast("You're already a member", "check"); return; }
    const questions = Array.isArray(org.join_questions) ? org.join_questions : (org.joinQuestions || []);
    if (!questions.length) { await submitApplication({}, org); return; }
    setApplyError(null);
    setApplyPrompt({ org: { ...org, join_questions: questions } });
  }

  async function submitApplication(answers, orgArg) {
    const org = orgArg || (applyPrompt && applyPrompt.org);
    if (!org) return;
    setApplySubmitting(true);
    setApplyError(null);
    const { data, error } = await clubService.applyToOrg(org.id, answers || {});
    setApplySubmitting(false);
    if (error) {
      const msg = clubErrorMessage(error, "Couldn't send that — try again");
      if (applyPrompt) setApplyError(msg); else toast(msg, "x");
      return { ok: false };
    }
    setStatus(org.id, { id: data.id, status: data.status });
    setApplyPrompt(null);
    toast(data.status === "accepted" ? "You're already a member" : "Application sent to " + org.name, "check");
    return { ok: true };
  }

  function cancelApply() { setApplyPrompt(null); setApplyError(null); }

  // Withdraw a pending application, or leave a club. Optimistic.
  async function leaveOrg(orgId) {
    if (!profile) return;
    const prev = memberships[orgId];
    if (!prev) return;
    setStatus(orgId, null);
    setMyClubs((c) => c.filter((o) => o.id !== orgId));
    if (!isSupabaseConfigured()) return;
    const { error } = await clubService.leaveOrg(orgId, profile.id);
    if (error) {
      setStatus(orgId, prev);
      toast("That didn't go through — try again", "x");
      return;
    }
    toast(prev.status === "accepted" ? "You left the club" : "Application withdrawn", "check");
  }

  // ---- org owner ----
  async function loadApplicants() {
    if (!orgAccount || !isSupabaseConfigured()) return;
    setApplicants((a) => ({ ...a, loading: true, error: null }));
    const [{ data, error }, { data: n }] = await Promise.all([
      clubService.getOrgApplicants(orgAccount.id),
      clubService.getOrgMemberCount(orgAccount.id),
    ]);
    setApplicants({ rows: data || [], loading: false, error: error || null, loaded: true });
    if (typeof n === "number") setOrgMemberCount(n);
  }

  async function decideApplicant(id, accept) {
    const prevRows = applicants.rows;
    const row = prevRows.find((r) => r.id === id);
    if (!row) return;
    const next = accept ? "accepted" : "rejected";
    setApplicants((a) => ({ ...a, rows: a.rows.map((r) => r.id === id ? { ...r, status: next, decidedAt: new Date().toISOString() } : r) }));
    if (accept) setOrgMemberCount((n) => (n === null ? n : n + 1));
    const { error } = await clubService.decideMembership(id, accept);
    if (error) {
      setApplicants((a) => ({ ...a, rows: prevRows }));
      if (accept) setOrgMemberCount((n) => (n === null ? n : Math.max(0, n - 1)));
      toast(clubErrorMessage(error, accept ? "Couldn't accept — try again" : "Couldn't decline — try again"), "x");
      return;
    }
    toast(accept ? "Welcome aboard — " + row.name + " is a member" : "Application declined", accept ? "check" : "x");
  }

  const pendingCount = applicants.rows.filter((r) => r.status === "pending").length;

  // signOut's wipe of this domain.
  function resetClubs() {
    setMemberships({});
    setMembershipsLoaded(false);
    loadRef.current = false;
    setMyClubs([]);
    setApplyPrompt(null);
    setApplySubmitting(false);
    setApplyError(null);
    setApplicants({ rows: [], loading: false, error: null, loaded: false });
    setOrgMemberCount(null);
  }

  return {
    memberships, membershipsLoaded, ensureMemberships, myClubs,
    applyPrompt, applySubmitting, applyError, requestJoin, submitApplication, cancelApply, leaveOrg,
    applicants, loadApplicants, decideApplicant, pendingCount, orgMemberCount,
    resetClubs,
  };
}
