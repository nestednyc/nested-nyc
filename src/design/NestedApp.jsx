/* ============================================================
   NESTED NYC — App shell, routing, state, tweaks
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { NestedData, CAT, isProjectAdmin, isProjectOwner } from './data'
import { Av, Toasts, Stamp } from './shared'
import { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle } from './tweaks-panel'
import Onboarding from './onboarding'
import ForgotPassword from './forgot'
import Discover, { ProjectCard } from './discover'
import Events from './events'
import Matches from './matches'
import People, { ContactLinks, ProfileModal } from './people'
import Notifications from './notifications'
import ProjectDetail from './detail'
import Profile from './profile'
import Create from './create'
import Edit from './edit'
import OrgSignup from './orgSignup'
import OrgOnboard from './orgOnboard'
import OrgDashboard from './orgDashboard'
import OrgEdit from './orgEdit'
import OrgProfile from './orgProfile'
import OrgView from './orgView'
import EventForm from './eventForm'
import EventDetail from './eventDetail'
import { SHOW_TWEAKS } from '../config/features'
import { isSupabaseConfigured, authService, supabase } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { orgService } from '../services/orgService'
import { eventService } from '../services/eventService'
import { storageService } from '../services/storageService'
import { toDbProfile, fromDbProfile, dataUrlToFile } from './profileAdapter'
import { projectService } from '../services/projectService'
import { toDbProject, fromDbProject, creatorTeamMember } from './projectAdapter'
import { toPerson } from './peopleAdapter'
import { connectionService } from '../services/connectionService'

  const { useState, useEffect, useRef } = React;

  const ACCENTS = [
    { v: "oklch(0.60 0.185 30)",  ink: "oklch(0.42 0.16 32)",  wash: "oklch(0.60 0.185 30 / 0.12)" },
    { v: "oklch(0.55 0.13 255)",  ink: "oklch(0.40 0.11 255)", wash: "oklch(0.55 0.13 255 / 0.12)" },
    { v: "oklch(0.55 0.13 152)",  ink: "oklch(0.40 0.11 152)", wash: "oklch(0.55 0.13 152 / 0.12)" },
    { v: "oklch(0.52 0.15 310)",  ink: "oklch(0.40 0.13 310)", wash: "oklch(0.52 0.15 310 / 0.12)" },
  ];

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "surface": "cork",
    "accent": "oklch(0.60 0.185 30)",
    "displayFont": "Bricolage Grotesque",
    "texture": true,
    "tilt": true
  }/*EDITMODE-END*/;

  const LS = "nested.nyc.v1";
  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
  }

  const NAV = [
    { id: "discover", label: "Discover", icon: "grid" },
    { id: "events",   label: "Events",   icon: "calendar" },
    { id: "people",   label: "People",   icon: "users" },
  ];

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const persisted = useRef(loadState());
    if (!persisted.current.joinedAt) persisted.current.joinedAt = Date.now();

    const [route, setRoute] = useState(persisted.current.profile ? (persisted.current.route || "discover") : "onboarding");
    const [profile, setProfile] = useState(persisted.current.profile || null);
    const [detailId, setDetailId] = useState(persisted.current.detailId || null);
    const [editId, setEditId] = useState(persisted.current.editId || null);
    // Supabase is the source of truth for these now — start empty and hydrate
    // from the services on login (see the project load effect below). `connected`
    // (outgoing) and `incoming` (who connected with you) are both persisted.
    const [saved, setSaved] = useState(new Set());
    // `joined` = projects you're an APPROVED member of ("You're in").
    // `requested` = projects you've asked to join, still pending approval
    // ("Request sent"). Two distinct states — never conflate them.
    const [joined, setJoined] = useState(new Set());
    const [requested, setRequested] = useState(new Set());
    const [rejected, setRejected] = useState(new Set());
    const [rsvped, setRsvped] = useState(new Set());
    const [connected, setConnected] = useState([]);
    const [projects, setProjects] = useState([]);
    const [people, setPeople] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [projectRequests, setProjectRequests] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    // A student profile being viewed in a modal (opened from a project's crew
    // list / lead). Resolved from `people` by user id. Null = closed.
    const [viewPerson, setViewPerson] = useState(null);
    // Start true when a Supabase hydration is actually coming (returning user with
    // a persisted profile) so the first paint is a skeleton, not a flash of the
    // empty state. The early-return below resolves it to false otherwise.
    const [projectsLoading, setProjectsLoading] = useState(() => !!(persisted.current.profile && persisted.current.profile.id && isSupabaseConfigured()));
    // Surface hydration error + retry. loadErrors is { discover, people, saved }
    // (each a Supabase error or undefined) so each page shows its own error
    // state; retrySurface bumps reloadNonce, which the loader effect depends on.
    const [loadErrors, setLoadErrors] = useState(null);
    const [reloadNonce, setReloadNonce] = useState(0);
    const retrySurface = () => setReloadNonce((n) => n + 1);
    // Org-account state. Populated by session hydration via orgService.getMyOrgs.
    // When orgAccount is non-null the user is signed in AS an organization,
    // not a student, and we render the OrgAppShell subtree instead of the
    // student app. orgEvents is loaded lazily on dashboard entry.
    const [orgAccount, setOrgAccount] = useState(null);
    const [orgEvents, setOrgEvents] = useState([]);
    const [orgEventsLoading, setOrgEventsLoading] = useState(false);
    const [eventDraftId, setEventDraftId] = useState(null);
    // Student-side org-profile navigation. Populated when a student clicks an
    // event's host pill; the orgView route loads the org by slug and renders
    // a public OrgProfile around it. Distinct from orgAccount (an authed
    // org owner viewing their OWN page via the orgPublic route).
    const [orgViewSlug, setOrgViewSlug] = useState(null);
    // The event the student is currently inspecting. Set by openEventDetail
    // from any of the feed surfaces (events tab, org public page, org view).
    // Cleared when leaving the route. Past/owner/anon variants are all
    // resolved inside the EventDetail screen.
    const [eventViewId, setEventViewId] = useState(null);
    // Where the user came from when opening an event, so Back goes home cleanly:
    // "events" (default), "orgView" (came from a host's public page), "orgPublic"
    // (org owner clicked their own event from their public-page surface).
    const [eventViewFrom, setEventViewFrom] = useState("events");
    const [query, setQuery] = useState("");
    const [soonLabel, setSoonLabel] = useState("Events");
    const [modal, setModal] = useState(null); // {type:'join'|'contact', project, lead}
    const [toasts, setToasts] = useState([]);
    const [justVerified, setJustVerified] = useState(false);
    // Email seed for the forgot-password screen, populated when the user
    // clicks "Forgot password?" from the signin step so they don't retype it.
    const [forgotEmailSeed, setForgotEmailSeed] = useState("");
    // Mobile-only chrome state (≤860px): the account sheet behind the avatar, and
    // the collapsible top-bar search. Both are inert on desktop — their only
    // triggers live in the mobile-only top-bar cluster, which is display:none above
    // the breakpoint — so this state never changes the desktop view.
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mSearchOpen, setMSearchOpen] = useState(false);

    // persist
    useEffect(() => {
      localStorage.setItem(LS, JSON.stringify({
        profile, route, detailId, editId,
        joinedAt: persisted.current.joinedAt,
      }));
    }, [profile, route, detailId, editId]);

    function toast(text, icon) {
      const id = Math.random().toString(36).slice(2);
      setToasts((arr) => [...arr, { id, text, icon }]);
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 2800);
    }

    // Load the org's events once when an orgAccount becomes active. Cheap
    // enough to do up front so the dashboard renders the list immediately;
    // refetch on org changes (e.g. after edit save).
    useEffect(() => {
      if (!orgAccount) return;
      let cancelled = false;
      setOrgEventsLoading(true);
      orgService.getOrgEvents(orgAccount.id).then(({ data }) => {
        if (cancelled) return;
        setOrgEvents(data || []);
        setOrgEventsLoading(false);
      });
      return () => { cancelled = true; };
    }, [orgAccount && orgAccount.id]);

    // Hydrate the student's project surface from Supabase once signed in.
    // Supabase is the source of truth; localStorage no longer caches these.
    // Mirrors the orgEvents loader above. Keyed on the user id so it runs once
    // per session, not on every profile field edit.
    useEffect(() => {
      if (!profile || !profile.id || !isSupabaseConfigured()) { setProjectsLoading(false); return; }
      let cancelled = false;
      setProjectsLoading(true);
      setLoadErrors(null);
      (async () => {
        try {
          const [disc, savedRes, joinedRes, requestedRes, rejRes, rsvpRes, peopleRes, connRes, incomingRes, reqInboxRes] = await Promise.all([
            projectService.getDiscoverProjects(),
            projectService.getSavedProjects(),
            projectService.getJoinedProjects(),
            projectService.getRequestedProjects(),
            projectService.getRejectedProjects(),
            eventService.getMyRegisteredEvents(),
            profileService.getAllProfiles(),
            connectionService.getMyConnections(),
            connectionService.getIncomingConnections(),
            projectService.getMyPendingRequests(),
          ]);
          if (cancelled) return;
          setProjects(((disc && disc.data) || []).map(fromDbProject));
          setSaved(new Set(((savedRes && savedRes.data) || []).map((p) => p.id)));
          setJoined(new Set(((joinedRes && joinedRes.data) || []).map((p) => p.id)));
          setRequested(new Set(((requestedRes && requestedRes.data) || []).map((p) => p.id)));
          setRejected(new Set(((rejRes && rejRes.data) || []).map((p) => p.id)));
          setRsvped(new Set(((rsvpRes && rsvpRes.data) || []).map((e) => e.id)));
          setPeople(((peopleRes && peopleRes.data) || [])
            .filter((r) => r.id !== profile.id && r.account_type !== "org_admin")
            .map(toPerson));
          setConnected(((connRes && connRes.data) || []).map((t) => t.id));
          setIncoming(((incomingRes && incomingRes.data) || [])
            .filter((r) => r.account_type !== "org_admin")
            .map(toPerson));
          setProjectRequests((reqInboxRes && reqInboxRes.data) || []);
          // Surface per-page load errors so each page can show its own retry.
          setLoadErrors({
            discover: disc && disc.error,
            people: (peopleRes && peopleRes.error) || (incomingRes && incomingRes.error),
            saved: (savedRes && savedRes.error) || (joinedRes && joinedRes.error) || (requestedRes && requestedRes.error) || (rejRes && rejRes.error),
            notifications: (incomingRes && incomingRes.error) || (reqInboxRes && reqInboxRes.error),
          });
        } catch (err) {
          // A thrown (rejected) service strands no state: log it and mark every
          // surface errored so the user gets a retry instead of a blank page.
          if (!cancelled) {
            console.error('Project surface hydration failed:', err);
            setLoadErrors({ discover: err, people: err, saved: err, notifications: err });
          }
        } finally {
          if (!cancelled) setProjectsLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [profile && profile.id, reloadNonce]);

    // Latest projects list, for realtime handlers below: they subscribe once per
    // session and must read the current projects without re-binding the channel.
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

    // ─── Session hydration ──────────────────────────────────────
    // Called on mount AND after the forgot-password flow completes, so a
    // fresh session is routed the same way as a returning session. Cached
    // localStorage profile renders instantly while this runs.
    async function hydrateSession(shouldAbort) {
      if (!isSupabaseConfigured()) return; // offline / no env — local-only mode
      const aborted = () => shouldAbort && shouldAbort();

      const sessRes = await authService.getSession();
      if (aborted()) return;
      const session = sessRes && sessRes.data && sessRes.data.session;

      if (!session) {
        // No live session — wipe any stale cached profile and go to onboarding
        if (persisted.current.profile) {
          setProfile(null);
          try { localStorage.removeItem(LS); } catch (e) {}
        }
        setRoute("onboarding");
        return;
      }

      // Branch on account_type: an authed user is either a student (has
      // profiles.onboarding_completed=true) or an org owner (owns a row in
      // organizations). We check org-ownership first because it's the
      // stronger signal: profile rows exist for all auth users, but only
      // org admins own an org. The org public_profiles view ALSO returns
      // org rows shaped as profiles, but those aren't what we want here.
      const myOrgs = await orgService.getMyOrgs();
      if (aborted()) return;
      const ownedOrg = (myOrgs.data && myOrgs.data[0]) || null;
      if (ownedOrg) {
        setOrgAccount(ownedOrg);
        setRoute("orgDashboard");
        return;
      }

      const { data: row, error } = await profileService.getCurrentProfile();
      if (aborted()) return;

      if (error || !row || !row.onboarding_completed) {
        // Signed-in user with no profile AND no org → either a fresh org
        // signup that hasn't created its org row yet (send to orgOnboarding)
        // or a student mid-onboarding. We can't distinguish reliably from
        // the row alone, so check user metadata.
        const metaAcct = session.user && session.user.user_metadata && session.user.user_metadata.account_type;
        setRoute(metaAcct === "org_admin" ? "orgOnboarding" : "onboarding");
        return;
      }

      const sessUser = session.user || {};
      const hydrated = fromDbProfile(row, sessUser.email);
      setProfile(hydrated);
      const cachedRoute = persisted.current.route;
      if (!cachedRoute || cachedRoute === "onboarding" || cachedRoute === "forgot") setRoute("discover");
    }

    useEffect(() => {
      let cancelled = false;
      hydrateSession(() => cancelled);

      // React to sign-out events fired from anywhere
      const sub = authService.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          setProfile(null);
          try { localStorage.removeItem(LS); } catch (e) {}
          setRoute("onboarding");
        }
      });

      return () => {
        cancelled = true;
        const inner = sub && sub.data && sub.data.subscription;
        if (inner && typeof inner.unsubscribe === "function") inner.unsubscribe();
      };
    }, []);

    // A lost/stale auth context surfaces as an RLS/JWT error: the request reached
    // Supabase as `anon`, so auth.uid() was null and a WITH CHECK (… = auth.uid())
    // policy rejected it. Used to decide when to refresh-and-retry a write.
    function isAuthError(err) {
      const m = ((err && (err.message || err.error_description)) || "").toLowerCase();
      const status = err && (err.status || err.statusCode);
      return status === 401 || status === 403 ||
        m.includes("row-level security") || m.includes("violates row-level") ||
        m.includes("jwt") || m.includes("token") || m.includes("expired") ||
        m.includes("not authenticated") || m.includes("unauthorized");
    }

    async function saveProfileToSupabase(draft) {
      // Local-only path when Supabase isn't configured
      if (!isSupabaseConfigured()) {
        setProfile(draft);
        toast("Saved locally", "check");
        return true;
      }

      // Pre-flight a valid session BEFORE any upload. A stale/expiring access token
      // is sent to Storage as `anon`, so its RLS check (folder = auth.uid()) fails
      // with "new row violates row-level security policy". One serial refresh up
      // front also sidesteps the concurrent-refresh race that loses the session.
      const { data: sessData } = await authService.getSession();
      const session = sessData && sessData.session;
      if (!session) { toast("Your session expired — please sign in again", "x"); return false; }
      if (session.expires_at && session.expires_at * 1000 - Date.now() < 120000) {
        await authService.refreshSession();
      }

      const userRes = await authService.getUser();
      const user = userRes && userRes.data && userRes.data.user;
      if (!user) { toast("Sign in to save your profile", "x"); return false; }
      const userId = user.id;

      // Upload any photo slot whose src is still a dataURL (just-picked)
      const nextDraft = { ...draft, photos: [...((draft && draft.photos) || [])] };
      for (let i = 0; i < nextDraft.photos.length; i++) {
        const slot = nextDraft.photos[i];
        if (!slot) continue;
        const src = typeof slot === "string" ? slot : slot.src;
        if (!src || !src.startsWith("data:")) continue;
        const file = await dataUrlToFile(src, "photo-" + i + ".jpg");
        if (!file) continue;
        let { url, error: upErr } = await storageService.uploadProfilePhoto(userId, file, i);
        // Lost/stale auth → refresh once and retry the upload.
        if (upErr && isAuthError(upErr)) {
          await authService.refreshSession();
          ({ url, error: upErr } = await storageService.uploadProfilePhoto(userId, file, i));
        }
        if (upErr) {
          toast(isAuthError(upErr)
            ? "Your session expired — please sign in again and retry"
            : "Photo " + (i + 1) + " failed: " + (upErr.message || "upload error"), "x");
          return false;
        }
        nextDraft.photos[i] = { src: url };
      }

      const payload = toDbProfile(nextDraft, userId);
      let { data: row, error: upsertErr } = await profileService.upsertProfile(userId, payload);
      if (upsertErr && isAuthError(upsertErr)) {
        await authService.refreshSession();
        ({ data: row, error: upsertErr } = await profileService.upsertProfile(userId, payload));
      }
      if (upsertErr) {
        toast(isAuthError(upsertErr)
          ? "Your session expired — please sign in again and retry"
          : "Couldn't save — " + (upsertErr.message || "try again"), "x");
        return false;
      }
      const hydrated = fromDbProfile(row, user.email);
      setProfile(hydrated);
      toast("Profile updated", "check");
      return true;
    }

    async function signOut() {
      if (isSupabaseConfigured()) {
        await authService.signOut();
      }
      setProfile(null);
      setProjects([]);
      setSaved(new Set());
      setJoined(new Set());
      setRequested(new Set());
      setRsvped(new Set());
      setConnected([]);
      setIncoming([]);
      setOrgAccount(null);
      setOrgEvents([]);
      setEventDraftId(null);
      setDetailId(null);
      setEditId(null);
      setRoute("onboarding");
      try { localStorage.removeItem(LS); } catch (e) {}
      toast("Signed out", "check");
    }

    function openProject(id) { setDetailId(id); setRoute("detail"); window.scrollTo({ top: 0 }); }
    function openEdit(id) {
      // Only an admin (owner or promoted co-admin) may open the editor.
      const proj = projectsList.find((p) => p.id === id);
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
      const prev = projectsList.find((p) => p.id === id);
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
      // Reflect the new crew member on the flyer optimistically.
      if (req) setProjects((arr) => arr.map((p) => p.id === req.project_id
        ? { ...p, joinedCount: (p.joinedCount || 0) + 1, team: [...(p.team || []), { name: req.name, role: req.role || "Member" }] }
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
    // Connections: optimistic add/remove with revert-on-failure (mirrors
    // toggleSave). People is controlled — it owns no connection state.
    // connect() treats a duplicate (23505) as success and a 0-row delete is a
    // no-op, so redundant calls are harmless.
    async function onConnect(id) {
      if (connected.includes(id)) return;
      setConnected((arr) => [...arr, id]);
      const p = people.find((x) => x.id === id);
      toast("Connected with " + (p ? p.name.split(" ")[0] : "them") + " — reach out via their links", "heart");
      if (!isSupabaseConfigured()) return;
      const { error } = await connectionService.connect(id);
      if (error) {
        setConnected((arr) => arr.filter((x) => x !== id));
        toast("Couldn't connect — " + (error.message || "try again"), "x");
      }
    }
    async function onDisconnect(id) {
      if (!connected.includes(id)) return;
      setConnected((arr) => arr.filter((x) => x !== id));
      if (!isSupabaseConfigured()) return;
      const { error } = await connectionService.disconnect(id);
      if (error) {
        setConnected((arr) => [...arr, id]);
        toast("Couldn't disconnect — " + (error.message || "try again"), "x");
      }
    }
    function goNav(id) {
      if (id === "discover" || id === "events" || id === "people" || id === "saved") { setRoute(id); }
      else { setSoonLabel(NAV.find((n) => n.id === id).label); setRoute("soon"); }
      window.scrollTo({ top: 0 });
    }
    async function toggleRsvp(id) {
      const wasOn = rsvped.has(id);
      // Optimistic toggle first so the button reacts instantly. If the
      // service call fails we revert below \u2014 the user sees a clear toast.
      setRsvped((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
      toast(wasOn ? "RSVP cancelled" : "You're going \u2014 see you there", wasOn ? "x" : "calendar");

      if (!isSupabaseConfigured()) return;
      const { error } = wasOn
        ? await eventService.unregisterFromEvent(id)
        : await eventService.registerForEvent(id);
      if (error) {
        setRsvped((s) => { const n = new Set(s); wasOn ? n.add(id) : n.delete(id); return n; });
        toast("RSVP didn't save \u2014 " + (error.message || "try again"), "x");
      }
    }

    function openEventDetail(id, from) {
      if (!id) return;
      setEventViewId(id);
      setEventViewFrom(from || "events");
      setRoute("eventDetail");
      window.scrollTo({ top: 0 });
    }

    function openOrgView(slug) {
      if (!slug) return;
      setOrgViewSlug(slug);
      setRoute("orgView");
      window.scrollTo({ top: 0 });
    }

    // Open a teammate's profile from a project's crew/lead. Self → own profile
    // page; everyone else → the shared People ProfileModal, resolved from the
    // already-loaded `people` list by user id.
    async function openProfile(userId) {
      if (!userId) return;
      if (profile && userId === profile.id) { setRoute("profile"); window.scrollTo({ top: 0 }); return; }
      const person = people.find((pp) => pp.id === userId);
      if (person) { setViewPerson(person); return; }
      // Not in the loaded People list (e.g. an event attendee who hasn't surfaced
      // in browse). Fall back to their public profile so the click still lands.
      if (!isSupabaseConfigured()) { toast("That profile isn't available yet", "x"); return; }
      const { data: row, error } = await profileService.getPublicProfile(userId);
      if (error || !row) { toast("That profile isn't available yet", "x"); return; }
      setViewPerson(toPerson(row));
    }

    async function submitModal(text) {
      if (!modal) return;
      // Only the join flow submits; the contact modal just surfaces real links.
      if (modal.type !== "join") { setModal(null); return; }
      const proj = modal.project;
      // A sent request is PENDING, not membership — track it in `requested`.
      // It graduates to `joined` only when the owner approves (next load).
      setRequested((r) => new Set(r).add(proj.id)); // optimistic
      setModal(null);
      toast("Request sent to " + proj.lead.name.split(" ")[0], "check");
      if (!isSupabaseConfigured()) return;
      // Inserts a pending team_members row (RLS: a user may add self as 'pending').
      const { error } = await projectService.joinProject(proj.id, "", text || "");
      if (error) {
        setRequested((r) => { const n = new Set(r); n.delete(proj.id); return n; });
        toast("Request didn't send — " + (error.message || "try again"), "x");
      }
    }

    const projectsList = projects;
    // Incoming connections the user hasn't reciprocated yet — drives the bell dot.
    const incomingPending = incoming.filter((p) => !connected.includes(p.id));
    // "My projects" = the ones I own, derived from the discover list (all my
    // flyers publish to discover). Drives the profile's pinned-projects rail.
    const myProjects = profile ? projectsList.filter((p) => isProjectOwner(p, profile)) : [];
    const detailProject = projectsList.find((p) => p.id === detailId);
    const accent = ACCENTS.find((a) => a.v === t.accent) || ACCENTS[0];

    const rootStyle = {
      "--accent": accent.v,
      "--accent-ink": accent.ink,
      "--accent-wash": accent.wash,
      "--disp": '"' + t.displayFont + '", sans-serif',
      "--tilt": t.tilt ? 1 : 0,
    };
    const rootClass = [
      "app",
      "surface-" + t.surface,
      t.texture ? "" : "no-texture",
    ].join(" ");

    // ---------- ONBOARDING (full-screen, no topbar) ----------
    if (route === "onboarding") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(Onboarding, {
            onComplete: (p) => {
              setProfile(p); setRoute("discover"); window.scrollTo({ top: 0 });
              toast("Welcome to Nested, @" + p.username, "sparkle");
              setJustVerified(true);
              setTimeout(() => setJustVerified(false), 1500);
            },
            onOrgPath: () => { setRoute("orgSignup"); window.scrollTo({ top: 0 }); },
            onForgot: (seedEmail) => {
              setForgotEmailSeed(seedEmail || "");
              setRoute("forgot");
              window.scrollTo({ top: 0 });
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- FORGOT PASSWORD (email → code → new password) ----------
    if (route === "forgot") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(ForgotPassword, {
            initialEmail: forgotEmailSeed,
            onBack: () => { setRoute("onboarding"); window.scrollTo({ top: 0 }); },
            onComplete: () => {
              // updatePassword left us with a real session — let the shared
              // hydration helper route us (student → discover, org → dashboard).
              toast("Password updated", "check");
              hydrateSession();
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- ORG SIGN-UP / SIGN-IN (separate auth path) ----------
    if (route === "orgSignup") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(OrgSignup, {
            onBack: () => setRoute("onboarding"),
            onSignedUp: () => {
              setRoute("orgOnboarding");
              window.scrollTo({ top: 0 });
            },
            onSignedIn: async () => {
              // Re-run the same getMyOrgs logic the session hydration uses, so
              // a returning org owner lands on their dashboard directly.
              const { data } = await orgService.getMyOrgs();
              const ownedOrg = (data && data[0]) || null;
              if (ownedOrg) {
                setOrgAccount(ownedOrg);
                setRoute("orgDashboard");
              } else {
                // Signed in but no org row yet — finish org onboarding.
                setRoute("orgOnboarding");
              }
              window.scrollTo({ top: 0 });
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- ORG ONBOARDING (post-signup, pre-dashboard) ----------
    if (route === "orgOnboarding") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(OrgOnboard, {
            onCancel: signOut,
            onCreated: (org) => {
              setOrgAccount(org);
              setRoute("orgDashboard");
              window.scrollTo({ top: 0 });
              toast("Your org is on the board", "pin");
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- ORG EDIT (owner-only) ----------
    if (route === "orgEditMe") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(OrgEdit, {
            org: orgAccount,
            onCancel: () => setRoute("orgDashboard"),
            onSaved: (org) => {
              setOrgAccount(org);
              setRoute("orgDashboard");
              toast("Org page updated", "check");
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- EVENT CREATE (owner-only) ----------
    if (route === "eventCreate" && orgAccount) {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(EventForm, {
            mode: "create",
            org: orgAccount,
            onCancel: () => setRoute("orgDashboard"),
            onSubmit: async (fields) => {
              const { data, error } = await eventService.createEvent({
                ...fields,
                organization_id: orgAccount.id,
              });
              if (error) {
                toast("Couldn't pin event — " + (error.message || "try again"), "x");
                return;
              }
              setOrgEvents((arr) => [data, ...arr]);
              setRoute("orgDashboard");
              toast("Pinned to the calendar", "pin");
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- EVENT EDIT (owner-only) ----------
    if (route === "eventEdit" && orgAccount && eventDraftId) {
      const draft = orgEvents.find((e) => e.id === eventDraftId);
      if (!draft) {
        setEventDraftId(null);
        setRoute("orgDashboard");
        return null;
      }
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(EventForm, {
            mode: "edit",
            org: orgAccount,
            initialValues: {
              title: draft.title || '',
              event_type: draft.event_type || '',
              description: draft.description || '',
              tags: draft.tags || [],
              date: draft.date || '',
              time: draft.time || '',
              duration: draft.duration || '',
              location: draft.location || '',
              address: draft.address || '',
              max_attendees: draft.max_attendees ? String(draft.max_attendees) : '',
            },
            onCancel: () => { setEventDraftId(null); setRoute("orgDashboard"); },
            onSubmit: async (fields) => {
              const { data, error } = await eventService.updateEvent(eventDraftId, fields);
              if (error) {
                toast("Couldn't save — " + (error.message || "try again"), "x");
                return;
              }
              setOrgEvents((arr) => arr.map((e) => e.id === eventDraftId ? { ...e, ...data } : e));
              setEventDraftId(null);
              setRoute("orgDashboard");
              toast("Event updated", "check");
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- CREATE (full-screen, no topbar — same shell as onboarding) ----------
    if (route === "create") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(Create, {
            profile,
            existingIds: new Set(projectsList.map((p) => p.id)),
            onCancel: () => setRoute("discover"),
            onCreate: async (project) => {
              setRoute("discover");
              window.scrollTo({ top: 0 });
              if (!isSupabaseConfigured()) {
                setProjects((arr) => [project, ...arr]);
                toast("Pinned to the board", "pin");
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
              toast("Pinned to the board", "pin");
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- EDIT (full-screen, no topbar) ----------
    if (route === "edit") {
      const editProject = projectsList.find((p) => p.id === editId);
      // Guard: if the project vanished (e.g. stale persisted editId), bail out.
      if (!editProject) {
        setEditId(null);
        setRoute(detailId ? "detail" : "discover");
        return null;
      }
      // Ownership lock: the real gate. Even if a non-admin reaches this route
      // (stale editId, hand-edited localStorage), refuse to render the editor.
      if (!isProjectAdmin(editProject, profile)) {
        setEditId(null);
        setRoute(detailId === editProject.id ? "detail" : "discover");
        toast("Only the person who pinned this can edit it", "x");
        return null;
      }
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(Edit, {
            project: editProject,
            profile,
            onCancel: () => {
              setEditId(null);
              setRoute(detailId === editProject.id ? "detail" : "discover");
            },
            onSave: async (updated) => {
              // Optimistic: drop the user back on the detail page immediately.
              setProjects((arr) => arr.map((p) => p.id === updated.id ? updated : p));
              setEditId(null);
              setDetailId(updated.id);
              setRoute("detail");
              if (!isSupabaseConfigured()) { toast("Flyer updated", "check"); return; }
              const { error } = await projectService.updateProject(updated.id, toDbProject(updated, updated.ownerId));
              if (error) toast("Couldn't save — " + (error.message || "try again"), "x");
              else toast("Flyer updated", "check");
            },
            onDelete: async (id) => {
              // Taking the flyer down is owner-only — co-admins can edit but
              // not delete. (Editor still guards entry; this is the backstop.)
              if (!isProjectOwner(editProject, profile)) {
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
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- ORG APP SHELL (dashboard + own public page) ----------
    if (orgAccount && (route === "orgDashboard" || route === "orgPublic" || route === "eventDetail")) {
      return (
        React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
          // Minimal topbar: brand + org chip + sign-out. No student NAV/search.
          React.createElement("header", { className: "topbar" },
            React.createElement("div", { className: "brand", onClick: () => setRoute("orgDashboard") },
              React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            ),
            React.createElement("nav", { className: "nav" },
              React.createElement("button", {
                className: route === "orgDashboard" ? "active" : "",
                onClick: () => setRoute("orgDashboard"),
              }, React.createElement(Icon, { name: "grid", size: 18 }), "Dashboard"),
              React.createElement("button", {
                className: route === "orgPublic" ? "active" : "",
                onClick: () => setRoute("orgPublic"),
              }, React.createElement(Icon, { name: "external", size: 18 }), "Public page")
            ),
            React.createElement("span", { className: "spacer", style: { flex: 1 } }),
            React.createElement("button", { className: "me-chip", onClick: signOut, title: "Sign out" },
              React.createElement(Av, { name: orgAccount.name }),
              React.createElement("span", { className: "who" },
                React.createElement("b", null, orgAccount.name),
                React.createElement("small", null, "Sign out →")
              )
            )
          ),

          route === "orgDashboard" && React.createElement(OrgDashboard, {
            org: orgAccount,
            events: orgEvents,
            loading: orgEventsLoading,
            onCreateEvent: () => { setRoute("eventCreate"); window.scrollTo({ top: 0 }); },
            onEditOrg: () => { setRoute("orgEditMe"); window.scrollTo({ top: 0 }); },
            onEditEvent: (id) => { setEventDraftId(id); setRoute("eventEdit"); window.scrollTo({ top: 0 }); },
            onViewPublic: () => { setRoute("orgPublic"); window.scrollTo({ top: 0 }); },
            onSignOut: signOut,
          }),

          route === "orgPublic" && React.createElement(OrgProfile, {
            org: orgAccount,
            events: (orgEvents || []).map((e) => ({
              id: e.id,
              type: e.event_type || 'talk',
              title: e.title,
              day: e.date ? new Date(e.date + 'T00:00:00').getDate().toString().padStart(2, '0') : '—',
              mon: e.date ? new Date(e.date + 'T00:00:00').toLocaleString('en-US', { month: 'short' }).toUpperCase() : '—',
              time: e.time || '',
              place: e.location || '',
              going: e.attendees || 0,
              goingNames: [],
              isPast: !!e.is_past,
            })),
            isOwner: true,
            following: false,
            onBack: () => setRoute("orgDashboard"),
            onOpenEvent: (id) => openEventDetail(id, "orgPublic"),
            onCreateEvent: () => setRoute("eventCreate"),
            onFollow: () => {},
          }),

          // Org owner viewing the public side of one of their own events.
          // EventDetail detects isOwner via orgAccount.id === event.organization_id
          // and swaps the RSVP CTA for "Edit event" → eventEdit.
          route === "eventDetail" && eventViewId && React.createElement(EventDetail, {
            eventId: eventViewId,
            profile,
            rsvped,
            orgAccount,
            onBack: () => { setEventViewId(null); setRoute(eventViewFrom === "orgPublic" ? "orgPublic" : "orgDashboard"); },
            onRSVP: toggleRsvp,
            onOpenOrg: openOrgView,
            onEditEvent: (id) => { setEventDraftId(id); setEventViewId(null); setRoute("eventEdit"); window.scrollTo({ top: 0 }); },
            onSignIn: () => {},
            onOpenProfile: openProfile,
            connected,
          }),

          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- MAIN APP (student) ----------
    return (
      React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
        // top bar
        React.createElement("header", { className: "topbar" },
          React.createElement("div", { className: "brand", onClick: () => goNav("discover") },
            React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
            React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
          ),
          React.createElement("nav", { className: "nav" },
            NAV.map((n) => (
              React.createElement("button", {
                key: n.id,
                className: (route === n.id) ? "active"
                  : (route === "soon" && soonLabel === n.label) ? "active" : "",
                onClick: () => goNav(n.id),
              }, React.createElement(Icon, { name: n.icon, size: 18 }), n.label)
            ))
          ),
          // Desktop utilities — display:contents on desktop so the topbar flex layout
          // (and .search's margin-left:auto) is byte-identical; display:none ≤860px.
          React.createElement("div", { className: "topbar-desk" },
            React.createElement("div", { className: "search" },
              React.createElement(Icon, { name: "search", size: 18 }),
              React.createElement("input", {
                placeholder: "Search projects, skills, schools…", value: query,
                onChange: (e) => { setQuery(e.target.value); if (route !== "discover") setRoute("discover"); },
              })
            ),
            React.createElement("button", { className: "iconbtn", onClick: () => goNav("saved"), title: "Saved projects" },
              React.createElement(Icon, { name: "bookmark", size: 20 })),
            React.createElement("button", { className: "iconbtn", onClick: () => { setRoute("notifications"); window.scrollTo({ top: 0 }); }, title: "Notifications" },
              React.createElement(Icon, { name: "bell", size: 20 }), (incomingPending.length + projectRequests.length) > 0 && React.createElement("span", { className: "dot" })),
            profile && justVerified && React.createElement("span", {
              className: "corner-stamp enter",
              title: "@" + profile.username + " · verified .edu student",
            }, React.createElement(Stamp, { size: 44 })),
            profile && React.createElement("button", { className: "me-chip", onClick: () => { setRoute("profile"); window.scrollTo({ top: 0 }); } },
              React.createElement(Av, { name: profile.username }),
              React.createElement("span", { className: "who" },
                React.createElement("b", null, "@" + profile.username),
                React.createElement("small", null, (NestedData.UNI[profile.uni] || {}).name)
              )
            )
          ),
          // Mobile-only cluster (≤860px): search toggle + avatar that opens the account sheet.
          React.createElement("div", { className: "topbar-mob" },
            React.createElement("button", { className: "iconbtn", onClick: () => setMSearchOpen((v) => !v), title: "Search", "aria-expanded": mSearchOpen ? "true" : "false" },
              React.createElement(Icon, { name: mSearchOpen ? "x" : "search", size: 20 })),
            profile && React.createElement("button", { className: "mob-avatar", onClick: () => setSheetOpen(true), title: "Account" },
              React.createElement(Av, { name: profile.username }),
              (incomingPending.length + projectRequests.length) > 0 && React.createElement("span", { className: "dot" })
            )
          )
        ),
        // Mobile search field — drops in under the bar when toggled (≤860px only).
        mSearchOpen && React.createElement("div", { className: "topbar-search-drop" },
          React.createElement("div", { className: "search-field" },
            React.createElement(Icon, { name: "search", size: 18 }),
            React.createElement("input", {
              autoFocus: true, placeholder: "Search projects, skills, schools…", value: query,
              onChange: (e) => { setQuery(e.target.value); if (route !== "discover") setRoute("discover"); },
            })
          )
        ),

        route === "discover" && React.createElement(Discover, {
          projects: projectsList, profile, saved, joined, requested, query,
          onOpen: openProject, onSave: toggleSave,
          onEdit: (p) => openEdit(p.id),
          onStart: () => setRoute("create"),
          loading: projectsLoading, error: loadErrors && loadErrors.discover, onRetry: retrySurface,
        }),

        route === "events" && React.createElement(Events, {
          rsvped, onRSVP: toggleRsvp, onOpenOrg: openOrgView,
          onOpenEvent: (id) => openEventDetail(id, "events"),
        }),

        route === "orgView" && orgViewSlug && React.createElement(OrgView, {
          slug: orgViewSlug,
          onBack: () => { setOrgViewSlug(null); goNav("events"); },
          onOpenEvent: (id) => openEventDetail(id, "orgView"),
          onToast: toast,
        }),

        // Student-side event detail. Drives back-navigation off eventViewFrom
        // so returning lands on whichever feed the user came from (events tab
        // or a host org's public page).
        route === "eventDetail" && eventViewId && React.createElement(EventDetail, {
          eventId: eventViewId,
          profile,
          rsvped,
          orgAccount,
          onBack: () => {
            setEventViewId(null);
            if (eventViewFrom === "orgView" && orgViewSlug) setRoute("orgView");
            else goNav("events");
          },
          onRSVP: toggleRsvp,
          onOpenOrg: openOrgView,
          onEditEvent: (id) => { setEventDraftId(id); setEventViewId(null); setRoute("eventEdit"); window.scrollTo({ top: 0 }); },
          onSignIn: () => { setEventViewId(null); setRoute("onboarding"); },
          onOpenProfile: openProfile,
          onConnect,
          connected,
        }),

        route === "people" && React.createElement(People, {
          people,
          connected,
          onConnect,
          onDisconnect,
          onToast: toast,
          loading: projectsLoading,
          error: loadErrors && loadErrors.people,
          onRetry: retrySurface,
        }),

        route === "notifications" && React.createElement(Notifications, {
          incoming,
          connected,
          projectRequests,
          onConnect,
          onApprove: approveRequest,
          onReject: rejectRequest,
          onContact: (link) => {
            if (link.kind === "discord") {
              try { if (navigator.clipboard) navigator.clipboard.writeText(link.label); } catch (e) {}
              toast("Copied " + link.label, "check");
            }
          },
          onOpenProject: openProject,
          loading: projectsLoading,
          error: loadErrors && loadErrors.notifications,
          onRetry: retrySurface,
        }),

        route === "saved" && React.createElement(Matches, {
          projects: projectsList, profile,
          saved, joined, requested, rejected, onOpen: openProject, onSave: toggleSave,
          onStart: () => setRoute("create"),
          onBrowse: () => goNav("discover"),
          onEdit: (p) => openEdit(p.id),
          loading: projectsLoading,
          error: loadErrors && loadErrors.saved,
          onRetry: retrySurface,
        }),

        route === "detail" && detailProject && React.createElement(ProjectDetail, {
          p: detailProject, profile,
          saved: saved.has(detailProject.id),
          joined: joined.has(detailProject.id), requested: requested.has(detailProject.id),
          pendingRequests,
          onApprove: approveRequest,
          onReject: rejectRequest,
          onBack: () => setRoute("discover"),
          onSave: toggleSave,
          onRequest: (p) => {
            if (joined.has(p.id)) { toast("You're already on this team", "check"); }
            else if (requested.has(p.id)) { toast("You've already requested to join", "check"); }
            else { setModal({ type: "join", project: p }); }
          },
          onEdit: (p) => openEdit(p.id),
          onUpdateStatus: updateProjectStatus,
          onOpenProfile: openProfile,
        }),

        route === "profile" && React.createElement(Profile, {
          profile,
          pinnedProjects: myProjects,
          projectCount: myProjects.length,
          eventCount: rsvped.size,
          connectionCount: connected.length,
          joinedAt: (profile && profile.joinedAt) || persisted.current.joinedAt,
          onBack: () => goNav("discover"),
          onOpenProject: openProject,
          onSaveProfile: saveProfileToSupabase,
          onSignOut: signOut,
        }),

        route === "soon" && React.createElement(SoonPane, { label: soonLabel, saved, joined, requested, projects: projectsList, onOpen: openProject, onSave: toggleSave, onBack: () => goNav("discover") }),

        modal && React.createElement(Modal, { modal, onClose: () => setModal(null), onSubmit: submitModal, profile }),
        viewPerson && React.createElement(ProfileModal, {
          person: viewPerson,
          connected: connected.includes(viewPerson.id),
          onClose: () => setViewPerson(null),
          onConnect: (id) => { connected.includes(id) ? onDisconnect(id) : onConnect(id); },
          onContact: (link) => {
            // discord → copy the handle; URL/email links open via the anchor.
            if (link.kind === "discord") {
              try { if (navigator.clipboard) navigator.clipboard.writeText(link.label); } catch (e) {}
              toast("Copied " + link.label, "check");
            }
          },
        }),
        // Mobile account sheet (≤860px) — opened by the top-bar avatar; nests
        // Profile / Saved / Notifications / Sign out so the mobile bar stays minimal.
        sheetOpen && profile && React.createElement("div", { className: "sheet-scrim", onClick: () => setSheetOpen(false) },
          React.createElement("div", { className: "acct-sheet", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "acct-head" },
              React.createElement(Av, { name: profile.username }),
              React.createElement("div", { className: "acct-id" },
                React.createElement("b", null, "@" + profile.username),
                React.createElement("small", null, (NestedData.UNI[profile.uni] || {}).name)
              )
            ),
            React.createElement("button", { className: "acct-item", onClick: () => { setSheetOpen(false); setRoute("profile"); window.scrollTo({ top: 0 }); } },
              React.createElement(Icon, { name: "user", size: 19 }), "Profile"),
            React.createElement("button", { className: "acct-item", onClick: () => { setSheetOpen(false); goNav("saved"); } },
              React.createElement(Icon, { name: "bookmark", size: 19 }), "Saved"),
            React.createElement("button", { className: "acct-item", onClick: () => { setSheetOpen(false); setRoute("notifications"); window.scrollTo({ top: 0 }); } },
              React.createElement(Icon, { name: "bell", size: 19 }), "Notifications",
              (incomingPending.length + projectRequests.length) > 0 && React.createElement("span", { className: "acct-badge" }, incomingPending.length + projectRequests.length)),
            React.createElement("button", { className: "acct-item danger", onClick: () => { setSheetOpen(false); signOut(); } },
              React.createElement(Icon, { name: "external", size: 19 }), "Sign out")
          )
        ),
        React.createElement(Toasts, { items: toasts }),
        React.createElement(StyleTweaks, { t, setTweak })
      )
    );
  }

  // ---------- Request to join / Contact modal ----------
  function Modal({ modal, onClose, onSubmit, profile }) {
    const [text, setText] = useState("");
    const isJoin = modal.type === "join";
    // CONTACT: surface the lead's REAL contact — the team-chat link they added on
    // their flyer. There's no messaging system, so we never fake a DM or an
    // "@edu" address; with no link, we point them to Request to join.
    if (!isJoin) {
      const lead = modal.lead;
      const proj = modal.project;
      const commLink = proj && (proj.communicationLink || proj.commLink);
      const links = commLink ? [{ kind: "site", url: commLink, label: "Open team chat" }] : [];
      return (
        React.createElement("div", { className: "scrim", onClick: onClose },
          React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "cat-bar", style: { background: "var(--accent)" } }),
            React.createElement("button", { className: "modal-close", onClick: onClose }, React.createElement(Icon, { name: "x", size: 18 })),
            React.createElement("div", { className: "modal-inner" },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 13, marginBottom: 16 } },
                React.createElement(Av, { name: lead.name }),
                React.createElement("div", null,
                  React.createElement("h2", { style: { fontSize: 23, marginBottom: 2 } }, "Reach " + lead.name.split(" ")[0]),
                  React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)" } }, lead.role))),
              links.length
                ? React.createElement(ContactLinks, { person: { links } })
                : React.createElement("p", { className: "contact-empty" },
                    lead.name.split(" ")[0] + " hasn't added a public contact link yet. Use ",
                    React.createElement("b", null, "Request to join"),
                    " to send them a note.")
            )
          )
        )
      );
    }
    // JOIN: the compose box — send a note to the project lead.
    const cat = CAT[modal.project.cat];
    const lead = modal.project.lead;
    const placeholder = "Hi " + lead.name.split(" ")[0] + " — I'm " + (profile ? "@" + profile.username : "a student") + ". I'd love to help with this because…";
    return (
      React.createElement("div", { className: "scrim", onClick: onClose },
        React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "cat-bar", style: { background: cat.color } }),
          React.createElement("button", { className: "modal-close", onClick: onClose }, React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("h2", null, "Request to join"),
            React.createElement("p", null,
              "Send a note to ", React.createElement("b", { key: "b" }, lead.name), ", who's leading ", React.createElement("b", { key: "b2" }, "“" + modal.project.title.split(" — ")[0] + "”"), ". A line about why you're a fit goes a long way."),
            React.createElement("textarea", { placeholder, value: text, autoFocus: true, onChange: (e) => setText(e.target.value) }),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onClose }, "Cancel"),
              React.createElement("button", { className: "btn btn-primary", onClick: () => onSubmit(text) },
                React.createElement(Icon, { name: "send", size: 16, stroke: "var(--paper)" }),
                "Send request")
            )
          )
        )
      )
    );
  }

  // ---------- "near-future surface" placeholder ----------
  function SoonPane({ label, saved, joined, requested, projects, onOpen, onSave, onBack }) {
    // Matches shows saved projects if any
    if (label === "Matches" && saved.size > 0) {
      const list = projects.filter((p) => saved.has(p.id));
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "disco-head" },
            React.createElement("div", null,
              React.createElement("h1", null, "Your ", React.createElement("em", null, "saved"), " board"),
              React.createElement("p", { className: "sub" }, "Projects you've pinned for later. The full Matches surface (your projects, requests, recommendations) is coming soon.")
            )
          ),
          React.createElement("div", { className: "board", style: { marginTop: 18 } },
            list.map((p) => React.createElement(ProjectCard, {
              key: p.id, p, saved: saved.has(p.id), joined: joined.has(p.id), requested: requested.has(p.id), onOpen, onSave,
            }))
          )
        )
      );
    }
    const copy = {
      Events: ["Events across NYC campuses", "Hackathons, demo days, mixers and workshops from every school on Nested — in one feed."],
      Matches: ["Your matches & saved", "Projects you've saved, your own projects, and requests to join will live here."],
      Profile: ["Your profile", "Your major, school, interests, photos, and the links teammates use to reach you."],
      "Create a project": ["Pin a new project", "Post what you're building and the roles you need. Recruit teammates from every NYC campus."],
    }[label] || [label, "Coming soon."];
    return (
      React.createElement("div", { className: "soon" },
        React.createElement("div", { className: "badge" }, React.createElement(Icon, { name: label === "Create a project" ? "plus" : (NAV.find((n) => n.label === label) || {}).icon || "sparkle", size: 40, stroke: "var(--accent)" })),
        React.createElement("h2", null, copy[0]),
        React.createElement("p", null, copy[1]),
        React.createElement("div", { className: "mono" }, "// behind a feature flag · near-future surface"),
        React.createElement("button", { className: "btn btn-primary", style: { marginTop: 24 }, onClick: onBack },
          React.createElement(Icon, { name: "arrowLeft", size: 16, stroke: "var(--paper)" }), "Back to the board")
      )
    );
  }

  // ---------- Tweaks ----------
  function StyleTweaks({ t, setTweak }) {
    if (!SHOW_TWEAKS) return null;
    return (
      React.createElement(TweaksPanel, { title: "Tweaks" },
        React.createElement(TweakSection, { label: "Overall style" }),
        React.createElement(TweakRadio, {
          label: "Surface", value: t.surface, options: ["cork", "newsprint", "riso"],
          onChange: (v) => setTweak("surface", v),
        }),
        React.createElement(TweakColor, {
          label: "Accent", value: t.accent,
          options: ACCENTS.map((a) => a.v),
          onChange: (v) => setTweak("accent", v),
        }),
        React.createElement(TweakRadio, {
          label: "Display font", value: t.displayFont, options: ["Bricolage Grotesque", "Anton"],
          onChange: (v) => setTweak("displayFont", v),
        }),
        React.createElement(TweakSection, { label: "Texture" }),
        React.createElement(TweakToggle, { label: "Paper grain", value: t.texture, onChange: (v) => setTweak("texture", v) }),
        React.createElement(TweakToggle, { label: "Pinned tilt", value: t.tilt, onChange: (v) => setTweak("tilt", v) })
      )
    );
  }

  export { App as NestedApp };
  export default App;
