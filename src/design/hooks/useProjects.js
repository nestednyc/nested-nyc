/* ============================================================
   useProjects — the cork-board domain: the discover feed, saved /
   joined / requested / rejected buckets, join-request inboxes, the
   tm-self realtime channel, deep-link cold-loading, view telemetry,
   and every project action (save, join, approve/reject, status,
   co-lead, kick, create/edit/delete).

   Domain-hook pattern: NestedApp stays the composition root. The
   signed-in Promise.all barrier hydrates this domain's buckets —
   that's why the set* hydration setters are exposed. resetProjects()
   is the projects slice of signOut's wipe (byte-match of the old
   inline resets; wiping rejected/projectRequests/pendingRequests too
   is a flagged follow-up). Router params (detailId/editId) stay
   root-owned and arrive as values + setters; the Edit-route render
   guards (skeleton hold, admin bounce) also stay in the root — they
   run during render and must not move into a child scope.
   ============================================================ */
import React from 'react'
import { isProjectAdmin, isProjectOwner } from '../data'
import { isSupabaseConfigured, authService, supabase } from '../../lib/supabase'
import { projectService, closeRole } from '../../services/projectService'
import { toDbProject, fromDbProject, creatorTeamMember } from '../projectAdapter'

const { useState, useEffect, useRef } = React;

// Project ids whose view was already recorded this browser session (per-tab,
// survives reloads). Applies to guests AND signed-in users — for the
// signed-in the server still dedupes per day; this just skips pointless RPCs.
const VIEWED_SS = "nested.nyc.viewed.v1";

export function useProjects({
  profile, route, detailId, editId, projectsLoading,
  setDetailId, setEditId, setRoute, toast, requireAuth,
}) {
  const viewedThisSession = useRef(null); // lazy Set, hydrated from sessionStorage

  const [projects, setProjects] = useState([]);
  // Supabase is the source of truth for these — start empty and hydrate from
  // the services on login (the root's Promise.all barrier).
  const [saved, setSaved] = useState(new Set());
  // `joined` = projects you're an APPROVED member of ("You're in").
  // `requested` = projects you've asked to join, still pending approval
  // ("Request sent"). Two distinct states — never conflate them.
  const [joined, setJoined] = useState(new Set());
  const [requested, setRequested] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());
  // Join requests across ALL my projects (the Notifications inbox) vs the
  // pending requests for the ONE project being viewed (the detail page).
  const [projectRequests, setProjectRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  // Deep-linked /projects/:id (view or edit) that isn't in the loaded feed:
  // "loading" while projectService.getProject resolves it, "missing" when it
  // doesn't exist / isn't visible to this viewer. "idle" otherwise.
  const [detailFetch, setDetailFetch] = useState("idle");

  // Cold-load: a deep-linked project missing from the hydrated feed (beyond
  // the feed page, fetched before the feed, or a direct link to something the
  // feed never carries). Wait for the feed to settle, then fetch by id —
  // anon-readable for published rows — and append-if-absent into `projects`
  // so the existing admin/saved/derived logic works unchanged.
  useEffect(() => {
    const wantedId = route === "detail" ? detailId : route === "edit" ? editId : null;
    if (!wantedId || !isSupabaseConfigured()) { setDetailFetch("idle"); return; }
    if (projectsLoading) return;
    if (projects.some((p) => p.id === wantedId)) { setDetailFetch("idle"); return; }
    let cancelled = false;
    setDetailFetch("loading");
    projectService.getProject(wantedId).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setDetailFetch("missing"); return; }
      const ui = fromDbProject(data);
      setProjects((arr) => (arr.some((p) => p.id === ui.id) ? arr : [...arr, ui]));
      setDetailFetch("idle");
    }).catch(() => { if (!cancelled) setDetailFetch("missing"); });
    return () => { cancelled = true; };
  }, [route, detailId, editId, projectsLoading, projects]);

  // Latest projects list, for the realtime handler below: it subscribes once
  // per session and must read the current projects without re-binding.
  const projectsRef = useRef([]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // ─── REALTIME: requester side ───────────────────────────────────────────
  // When a project owner approves (or declines / I withdraw) my join request,
  // my team_members row changes server-side. We subscribe to just MY rows and
  // patch the two Sets in place — so an approved project slides out of
  // "Requests" and into "My projects" live, with no refetch (hence no skeleton
  // flash). Approved projects are already published, so they're in `projects`
  // and render immediately. RLS hides every row unless the socket carries the
  // user's JWT, so we set it before subscribing. No-op in mock mode.
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
        .channel("tm-self-" + profile.id)
        .on("postgres_changes", {
          event: "*", schema: "public", table: "team_members",
          filter: "user_id=eq." + profile.id,
        }, (payload) => {
          // DELETE carries only the old row; UPDATE/INSERT the new one.
          const row = (payload.new && payload.new.project_id) ? payload.new : payload.old;
          const pid = row && row.project_id;
          if (!pid) return;
          const status = payload.new && payload.new.status;
          if (payload.eventType === "DELETE" || status === "rejected") {
            // Request withdrawn or declined — drop it from both buckets.
            setRequested((r) => { if (!r.has(pid)) return r; const n = new Set(r); n.delete(pid); return n; });
            setJoined((j) => { if (!j.has(pid)) return j; const n = new Set(j); n.delete(pid); return n; });
          } else if (status === "approved") {
            setRequested((r) => { const n = new Set(r); n.delete(pid); return n; });
            setJoined((j) => new Set(j).add(pid));
            const proj = projectsRef.current.find((p) => p.id === pid);
            toast((proj ? "“" + proj.title.split(" — ")[0] + "”" : "A project") + " accepted you — it's in My projects", "check");
          } else if (status === "pending") {
            // Request created on another device — keep this tab in sync.
            setRequested((r) => new Set(r).add(pid));
          }
        })
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [profile && profile.id]);

  // Owner-only: load pending join requests for the project being viewed, so
  // the owner can approve/decline from the project page.
  useEffect(() => {
    if (route !== "detail" || !detailId || !profile || !profile.id || !isSupabaseConfigured()) {
      setPendingRequests([]);
      return;
    }
    const proj = projects.find((p) => p.id === detailId);
    if (!proj || !isProjectAdmin(proj, profile)) { setPendingRequests([]); return; }
    let cancelled = false;
    projectService.getPendingRequests(detailId).then(({ data }) => {
      if (!cancelled) setPendingRequests(data || []);
    });
    return () => { cancelled = true; };
  }, [route, detailId, profile && profile.id, projects]);

  function sessionViewed() {
    if (!viewedThisSession.current) {
      let ids = [];
      try { ids = JSON.parse(sessionStorage.getItem(VIEWED_SS)) || []; } catch (e) {}
      viewedThisSession.current = new Set(Array.isArray(ids) ? ids : []);
    }
    return viewedThisSession.current;
  }
  // Background telemetry — fire-and-forget and SILENT on failure (the one
  // deliberate exception to the "every service failure toasts" rule: a lost
  // view isn't worth interrupting anyone over). The server is the authority
  // on every rule here (owner never counts, signed-in once/day); the checks
  // below just skip RPCs whose answer we already know.
  function recordProjectView(id) {
    if (!isSupabaseConfigured()) return;
    const proj = projects.find((p) => p.id === id);
    if (profile && proj && proj.ownerId === profile.id) return; // own opens never count
    const seen = sessionViewed();
    if (seen.has(id)) return; // once per browser session
    seen.add(id);
    try { sessionStorage.setItem(VIEWED_SS, JSON.stringify([...seen])); } catch (e) {}
    projectService.recordView(id).then(({ data }) => {
      // The RPC returns the fresh total — sync it so the visitor watches
      // their own hit land on the detail page's counter.
      if (typeof data === "number") {
        setProjects((arr) => arr.map((p) => (p.id === id ? { ...p, views: data } : p)));
      }
    }).catch(() => {});
  }
  function openProject(id) { recordProjectView(id); setDetailId(id); setRoute("detail"); window.scrollTo({ top: 0 }); }
  function openEdit(id) {
    // Only an admin (owner or promoted co-admin) may open the editor.
    const proj = projects.find((p) => p.id === id);
    if (!proj || !isProjectAdmin(proj, profile)) {
      toast("Only the person who pinned this can edit it", "x");
      return;
    }
    setEditId(id); setRoute("edit"); window.scrollTo({ top: 0 });
  }
  // Inline status/alert update from the project page. Admin-only (the page
  // also hides the controls from non-admins; this is the backstop). Patch is
  // {status} or {alert} — both are real columns now. Optimistic, reverts with
  // a toast if the write fails.
  async function updateProjectStatus(id, patch) {
    const prev = projects.find((p) => p.id === id);
    if (!prev || !isProjectAdmin(prev, profile)) {
      toast("Only an admin can update this project", "x");
      return;
    }
    setProjects((arr) => arr.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
    toast("status" in patch ? "Status updated" : "Update posted", "check");
    if (!isSupabaseConfigured()) return;
    const { error } = await projectService.updateProject(id, patch);
    if (error) {
      setProjects((arr) => arr.map((p) => p.id === id ? prev : p));
      toast("Couldn't save — " + (error.message || "try again"), "x");
    }
  }
  // Owner-only: promote a crew member into projects.admins (co-lead) or
  // demote them. Co-leads can edit the flyer / post updates / run the join
  // inbox, but only the OWNER may change the admins list itself — the DB
  // enforces that with the projects_guard_ownership trigger; this check is
  // the client-side mirror. Optimistic; the failure path undoes THIS toggle
  // against current state (never restores a whole snapshot, which would
  // clobber other crew ops that landed in between).
  async function setCoLead(projectId, userId, make) {
    const prev = projects.find((p) => p.id === projectId);
    if (!prev || !isProjectOwner(prev, profile)) {
      toast("Only the owner can change co-leads", "x");
      return;
    }
    if (!userId || userId === prev.ownerId) return;
    const base = Array.isArray(prev.admins) ? prev.admins : [];
    const admins = make
      ? [...new Set([...base, userId])]
      : base.filter((a) => a !== userId);
    const toggleAdmin = (list, on) => {
      const cur = Array.isArray(list) ? list : [];
      return on ? [...new Set([...cur, userId])] : cur.filter((a) => a !== userId);
    };
    setProjects((arr) => arr.map((p) => (p.id === projectId ? { ...p, admins: toggleAdmin(p.admins, make) } : p)));
    const member = (prev.team || []).find((t) => t.userId === userId);
    const who = member ? member.name.split(" ")[0] : "They";
    toast(make ? who + " now co-leads this project" : who + " is no longer a co-lead", make ? "sparkle" : "x");
    if (!isSupabaseConfigured()) return;
    const { error } = await projectService.setProjectAdmins(projectId, admins);
    if (error) {
      setProjects((arr) => arr.map((p) => (p.id === projectId ? { ...p, admins: toggleAdmin(p.admins, !make) } : p)));
      toast("Couldn't update co-leads — " + (error.message || "try again"), "x");
    }
  }
  // Remove a crew member entirely. The owner can remove anyone; a co-lead can
  // remove REGULAR crew but not another co-lead or the owner — the RLS DELETE
  // policy (20260709000000) mirrors this product rule, and the ownership
  // guard's convergent-revocation branch keeps the grant revoke safe even
  // when a kick races a promote. ONE call — deleting the team_members row also revokes
  // any co-lead grant atomically via the team_members_revoke_admin DB trigger,
  // so there's no two-step partial state to manage. Optimistic; failure
  // re-inserts THIS member against current state rather than restoring a stale
  // snapshot.
  async function kickMember(projectId, userId) {
    const prev = projects.find((p) => p.id === projectId);
    if (!prev || !isProjectAdmin(prev, profile)) {
      toast("Only an admin can remove crew", "x");
      return;
    }
    if (!userId || userId === prev.ownerId) return;
    // Co-leads can remove regular crew, but only the OWNER may remove another
    // co-lead (mirrors the owner-manages-admins rule + the RLS DELETE policy).
    const targetIsCoLead = (Array.isArray(prev.admins) ? prev.admins : []).includes(userId);
    if (targetIsCoLead && !isProjectOwner(prev, profile)) {
      toast("Only the owner can remove a co-lead", "x");
      return;
    }
    const member = (prev.team || []).find((t) => t.userId === userId);
    if (!member) return;
    const wasCoLead = (Array.isArray(prev.admins) ? prev.admins : []).includes(userId);
    const applyKick = (p) => ({
      ...p,
      team: (p.team || []).filter((t) => t.userId !== userId),
      admins: (Array.isArray(p.admins) ? p.admins : []).filter((a) => a !== userId),
      joinedCount: Math.max(0, (p.joinedCount || 0) - 1),
    });
    const undoKick = (p) => ({
      ...p,
      team: (p.team || []).some((t) => t.userId === userId) ? p.team : [...(p.team || []), member],
      admins: wasCoLead ? [...new Set([...(Array.isArray(p.admins) ? p.admins : []), userId])] : p.admins,
      joinedCount: (p.joinedCount || 0) + 1,
    });
    setProjects((arr) => arr.map((p) => (p.id === projectId ? applyKick(p) : p)));
    toast(member.name.split(" ")[0] + " was removed from the crew", "x");
    if (!isSupabaseConfigured()) return;
    if (!member.memberId) {
      setProjects((arr) => arr.map((p) => (p.id === projectId ? undoKick(p) : p)));
      toast("Couldn't remove them — try again", "x");
      return;
    }
    const { error } = await projectService.removeTeamMember(member.memberId);
    if (error) {
      setProjects((arr) => arr.map((p) => (p.id === projectId ? undoKick(p) : p)));
      toast("Couldn't remove them — " + (error.message || "try again"), "x");
    }
  }
  // Owner-only: approve/decline a pending join request (team_members status).
  // Requests can be acted on from the project detail page (pendingRequests, one
  // project) OR the Notifications inbox (projectRequests, all projects). Update
  // whichever list(s) held the row so both surfaces stay in sync.
  async function approveRequest(memberId) {
    const inPending = pendingRequests.find((r) => r.id === memberId);
    const inInbox = projectRequests.find((r) => r.id === memberId);
    const req = inPending || inInbox;
    if (inPending) setPendingRequests((arr) => arr.filter((r) => r.id !== memberId));
    if (inInbox) setProjectRequests((arr) => arr.filter((r) => r.id !== memberId));
    const { error } = await projectService.approveRequest(memberId);
    if (error) {
      toast("Couldn't approve — " + (error.message || "try again"), "x");
      if (inPending) setPendingRequests((arr) => [inPending, ...arr]);
      if (inInbox) setProjectRequests((arr) => [inInbox, ...arr]);
      return;
    }
    // Reflect the new crew member on the flyer optimistically: bump joined,
    // close the role they applied for so "N roles open" drops in the same
    // render (mirrors close_project_role server-side), AND carry the ids the
    // crew-manager features key off (promote needs userId, kick needs
    // memberId) so the fresh member is manageable without a reload.
    if (req) setProjects((arr) => arr.map((p) => p.id === req.project_id
      ? { ...p, joinedCount: (p.joinedCount || 0) + 1, roles: closeRole(p.roles, req.role), team: [...(p.team || []), { name: req.name, handle: req.handle, role: req.role || "Member", userId: req.user_id || null, memberId: req.id || null }] }
      : p));
    toast("Added to the crew", "check");
  }
  async function rejectRequest(memberId) {
    const inPending = pendingRequests.find((r) => r.id === memberId);
    const inInbox = projectRequests.find((r) => r.id === memberId);
    if (inPending) setPendingRequests((arr) => arr.filter((r) => r.id !== memberId));
    if (inInbox) setProjectRequests((arr) => arr.filter((r) => r.id !== memberId));
    const { error } = await projectService.rejectRequest(memberId);
    if (error) {
      toast("Couldn't decline — " + (error.message || "try again"), "x");
      if (inPending) setPendingRequests((arr) => [inPending, ...arr]);
      if (inInbox) setProjectRequests((arr) => [inInbox, ...arr]);
    } else {
      toast("Request declined", "x");
    }
  }
  async function toggleSave(id) {
    if (!profile) return requireAuth("Sign up to save projects");
    const wasSaved = saved.has(id);
    setSaved((s) => { const n = new Set(s); wasSaved ? n.delete(id) : n.add(id); return n; });
    toast(wasSaved ? "Removed from saved" : "Saved to your board", "bookmark");
    if (!isSupabaseConfigured()) return;
    const { error } = wasSaved
      ? await projectService.unsaveProject(id)
      : await projectService.saveProject(id);
    if (error) {
      setSaved((s) => { const n = new Set(s); wasSaved ? n.add(id) : n.delete(id); return n; });
      toast("Couldn't update saved — " + (error.message || "try again"), "x");
    }
  }
  // A sent request is PENDING, not membership — track it in `requested`.
  // It graduates to `joined` only when the owner approves (next load). The
  // root's submitModal owns the modal state and hands the project here.
  async function submitJoinRequest(proj, text, role) {
    setRequested((r) => new Set(r).add(proj.id)); // optimistic
    toast("Request sent to " + proj.lead.name.split(" ")[0], "check");
    if (!isSupabaseConfigured()) return;
    // Inserts a pending team_members row (RLS: a user may add self as 'pending').
    // role = the specific open role the applicant picked (or "" when the project
    // has no open roles / a single one was auto-targeted by the modal).
    const { error } = await projectService.joinProject(proj.id, role || "", text || "");
    if (error) {
      setRequested((r) => { const n = new Set(r); n.delete(proj.id); return n; });
      toast("Request didn't send — " + (error.message || "try again"), "x");
    }
  }
  // Pin a new flyer (hoisted from the Create screen's onCreate): optimistic
  // route home first, then create + stamp the creator into the crew so
  // joinedCount + the team join work.
  async function createProject(project) {
    setRoute("discover");
    window.scrollTo({ top: 0 });
    if (!isSupabaseConfigured()) {
      setProjects((arr) => [project, ...arr]);
      toast("Pinned to the board");
      return;
    }
    const { data: row, error } = await projectService.createProject(toDbProject(project, profile && profile.id));
    if (error || !row) {
      toast("Couldn't pin — " + ((error && error.message) || "try again"), "x");
      return;
    }
    // Stamp the creator into the crew so joinedCount + the team join work.
    const lead = creatorTeamMember(profile, row.owner_id);
    await projectService.addTeamMember(row.id, lead);
    const uiProject = fromDbProject({ ...row, team_members: [lead] });
    setProjects((arr) => [uiProject, ...arr]);
    toast("Pinned to the board");
  }
  // Save flyer edits (hoisted from the Edit screen's onSave): optimistic —
  // drop the user back on the detail page immediately.
  async function saveProjectEdits(updated) {
    setProjects((arr) => arr.map((p) => p.id === updated.id ? updated : p));
    setEditId(null);
    setDetailId(updated.id);
    setRoute("detail");
    if (!isSupabaseConfigured()) { toast("Flyer updated", "check"); return; }
    const { error } = await projectService.updateProject(updated.id, toDbProject(updated, updated.ownerId));
    if (error) toast("Couldn't save — " + (error.message || "try again"), "x");
    else toast("Flyer updated", "check");
  }
  // Take the flyer down (hoisted from the Edit screen's onDelete). Owner-only
  // — co-admins can edit but not delete; the editor still guards entry, this
  // is the backstop. Recomputes the project by id (the old lambda closed over
  // the render-scope editProject; Edit only mounts when the project is in the
  // feed, so the lookup is equivalent).
  async function deleteProjectById(id) {
    const proj = projects.find((p) => p.id === id);
    if (!proj || !isProjectOwner(proj, profile)) {
      toast("Only the owner can take this flyer down", "x");
      return;
    }
    setProjects((arr) => arr.filter((p) => p.id !== id));
    setSaved((s) => { const n = new Set(s); n.delete(id); return n; });
    setJoined((j) => { const n = new Set(j); n.delete(id); return n; });
    setRequested((r) => { const n = new Set(r); n.delete(id); return n; });
    setEditId(null);
    if (detailId === id) setDetailId(null);
    setRoute("discover");
    toast("Flyer taken down", "x");
    if (!isSupabaseConfigured()) return;
    const { error } = await projectService.deleteProject(id);
    if (error) toast("Delete didn't sync — " + (error.message || "try again"), "x");
  }

  // signOut's wipe of this domain — the exact resets the old inline signOut
  // performed (rejected/projectRequests/pendingRequests were never cleared;
  // widening is a flagged follow-up).
  function resetProjects() {
    setProjects([]);
    setSaved(new Set());
    setJoined(new Set());
    setRequested(new Set());
  }

  // "My projects" = the ones I own OR co-lead (a promoted co-lead runs the
  // flyer too), derived from the discover list (all my flyers publish to
  // discover). Drives the profile's pinned-projects rail.
  const myProjects = profile ? projects.filter((p) => isProjectAdmin(p, profile)) : [];
  const detailProject = projects.find((p) => p.id === detailId);

  return {
    // feed + buckets (setters exposed for the root hydration barrier)
    projects, setProjects, saved, setSaved, joined, setJoined,
    requested, setRequested, rejected, setRejected,
    projectRequests, setProjectRequests, pendingRequests,
    detailFetch, myProjects, detailProject,
    // actions
    openProject, openEdit, toggleSave, submitJoinRequest,
    updateProjectStatus, setCoLead, kickMember, approveRequest, rejectRequest,
    createProject, saveProjectEdits, deleteProjectById, resetProjects,
  };
}
