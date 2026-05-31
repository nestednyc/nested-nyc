/* ============================================================
   NESTED NYC — App shell, routing, state, tweaks
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { PROJECTS, NestedData, PEOPLE, CAT, isProjectAdmin, isProjectOwner } from './data'
import { Av, Toasts, Stamp } from './shared'
import { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle } from './tweaks-panel'
import Onboarding from './onboarding'
import ForgotPassword from './forgot'
import Discover, { ProjectCard } from './discover'
import Events from './events'
import Matches from './matches'
import People, { ContactLinks } from './people'
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
import { isSupabaseConfigured, authService } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { orgService } from '../services/orgService'
import { eventService } from '../services/eventService'
import { storageService } from '../services/storageService'
import { toDbProfile, fromDbProfile, dataUrlToFile } from './profileAdapter'

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
    const [saved, setSaved] = useState(new Set(persisted.current.saved || []));
    const [joined, setJoined] = useState(new Set(persisted.current.joined || []));
    const [rsvped, setRsvped] = useState(new Set(persisted.current.rsvped || []));
    const [connected, setConnected] = useState(persisted.current.connected || []);
    const [created, setCreated] = useState(persisted.current.created || []);
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

    // persist
    useEffect(() => {
      localStorage.setItem(LS, JSON.stringify({
        profile, route, detailId, editId,
        saved: [...saved], joined: [...joined], rsvped: [...rsvped], connected, created,
        joinedAt: persisted.current.joinedAt,
      }));
    }, [profile, route, detailId, editId, saved, joined, rsvped, connected, created]);

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

    async function saveProfileToSupabase(draft) {
      // Local-only path when Supabase isn't configured
      if (!isSupabaseConfigured()) {
        setProfile(draft);
        toast("Saved locally", "check");
        return true;
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
        const { url, error: upErr } = await storageService.uploadProfilePhoto(userId, file, i);
        if (upErr) {
          toast("Photo " + (i + 1) + " failed: " + (upErr.message || "upload error"), "x");
          return false;
        }
        nextDraft.photos[i] = { src: url };
      }

      const payload = toDbProfile(nextDraft, userId);
      const { data: row, error: upsertErr } = await profileService.upsertProfile(userId, payload);
      if (upsertErr) {
        toast("Couldn't save — " + (upsertErr.message || "try again"), "x");
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
      setCreated([]);
      setSaved(new Set());
      setJoined(new Set());
      setRsvped(new Set());
      setConnected([]);
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
    // also hides the controls from non-admins; this is the backstop). Patch
    // is {status} or {alert}. Writes to `created` — the only place owned
    // projects live — and persists via the localStorage effect.
    // Phase 2: call projectService.updateProject(id, patch) here.
    function updateProjectStatus(id, patch) {
      const proj = projectsList.find((p) => p.id === id);
      if (!proj || !isProjectAdmin(proj, profile)) {
        toast("Only an admin can update this project", "x");
        return;
      }
      setCreated((arr) => arr.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
      toast("status" in patch ? "Status updated" : "Update posted", "check");
    }
    function toggleSave(id) {
      setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); toast(n.has(id) ? "Saved to your board" : "Removed from saved", "bookmark"); return n; });
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

    function submitModal(text) {
      if (!modal) return;
      // Only the join flow submits; the contact modal just surfaces real links.
      if (modal.type === "join") {
        setJoined((j) => new Set(j).add(modal.project.id));
        toast("Request sent to " + modal.project.lead.name.split(" ")[0], "check");
      }
      setModal(null);
    }

    const projectsList = [...created, ...PROJECTS];
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
            onCreate: (project) => {
              setCreated((arr) => [project, ...arr]);
              setRoute("discover");
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
            onSave: (updated) => {
              // Phase 2: call projectService.updateProject(updated) here.
              setCreated((arr) => arr.map((p) => p.id === updated.id ? updated : p));
              setEditId(null);
              setDetailId(updated.id);
              setRoute("detail");
              toast("Flyer updated", "check");
            },
            onDelete: (id) => {
              // Taking the flyer down is owner-only — co-admins can edit but
              // not delete. (Editor still guards entry; this is the backstop.)
              if (!isProjectOwner(editProject, profile)) {
                toast("Only the owner can take this flyer down", "x");
                return;
              }
              // Phase 2: call projectService.deleteProject(id) here.
              setCreated((arr) => arr.filter((p) => p.id !== id));
              setSaved((s) => { const n = new Set(s); n.delete(id); return n; });
              setJoined((j) => { const n = new Set(j); n.delete(id); return n; });
              setEditId(null);
              if (detailId === id) setDetailId(null);
              setRoute("discover");
              toast("Flyer taken down", "x");
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
          React.createElement("div", { className: "search" },
            React.createElement(Icon, { name: "search", size: 18 }),
            React.createElement("input", {
              placeholder: "Search projects, skills, schools…", value: query,
              onChange: (e) => { setQuery(e.target.value); if (route !== "discover") setRoute("discover"); },
            })
          ),
          React.createElement("button", { className: "iconbtn", onClick: () => goNav("saved"), title: "Saved projects" },
            React.createElement(Icon, { name: "bookmark", size: 20 })),
          React.createElement("button", { className: "iconbtn", onClick: () => { setSoonLabel("Notifications"); setRoute("soon"); }, title: "Notifications" },
            React.createElement(Icon, { name: "bell", size: 20 }), React.createElement("span", { className: "dot" })),
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

        route === "discover" && React.createElement(Discover, {
          projects: projectsList, profile, saved, joined, query,
          onOpen: openProject, onSave: toggleSave,
          onStart: () => setRoute("create"),
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
        }),

        route === "people" && React.createElement(People, {
          initialConnected: connected,
          onConnectedChange: (arr) => setConnected(arr),
          onToast: toast,
        }),

        route === "saved" && React.createElement(Matches, {
          projects: projectsList, profile,
          saved, joined, onOpen: openProject, onSave: toggleSave,
          onStart: () => setRoute("create"),
          onBrowse: () => goNav("discover"),
          onEdit: (p) => openEdit(p.id),
        }),

        route === "detail" && detailProject && React.createElement(ProjectDetail, {
          p: detailProject, profile,
          saved: saved.has(detailProject.id), joined: joined.has(detailProject.id),
          onBack: () => setRoute("discover"),
          onSave: toggleSave,
          onRequest: (p) => { if (joined.has(p.id)) { toast("You've already requested to join", "check"); } else { setModal({ type: "join", project: p }); } },
          onMessage: (project) => setModal({ type: "contact", project, lead: project.lead }),
          onEdit: (p) => openEdit(p.id),
          onUpdateStatus: updateProjectStatus,
        }),

        route === "profile" && React.createElement(Profile, {
          profile,
          pinnedProjects: created,
          projectCount: created.length,
          eventCount: rsvped.size,
          connectionCount: connected.length,
          joinedAt: (profile && profile.joinedAt) || persisted.current.joinedAt,
          onBack: () => goNav("discover"),
          onOpenProject: openProject,
          onSaveProfile: saveProfileToSupabase,
          onSignOut: signOut,
        }),

        route === "soon" && React.createElement(SoonPane, { label: soonLabel, saved, joined, projects: projectsList, onOpen: openProject, onSave: toggleSave, onBack: () => goNav("discover") }),

        modal && React.createElement(Modal, { modal, onClose: () => setModal(null), onSubmit: submitModal, profile }),
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
            React.createElement("h2", null, isJoin ? "Request to join" : "Message " + lead.name.split(" ")[0]),
            React.createElement("p", null, isJoin
              ? ["Send a note to ", React.createElement("b", { key: "b" }, lead.name), ", who's leading ", React.createElement("b", { key: "b2" }, "\u201C" + modal.project.title.split(" — ")[0] + "\u201D"), ". A line about why you're a fit goes a long way."]
              : ["Direct message to ", React.createElement("b", { key: "b" }, lead.name), " · ", lead.role, "."]),
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
  function SoonPane({ label, saved, joined, projects, onOpen, onSave, onBack }) {
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
              key: p.id, p, saved: saved.has(p.id), joined: joined.has(p.id), onOpen, onSave,
            }))
          )
        )
      );
    }
    const copy = {
      Events: ["Events across NYC campuses", "Hackathons, demo days, mixers and workshops from every school on Nested — in one feed."],
      Matches: ["Your matches & saved", "Projects you've saved, your own projects, and requests to join will live here."],
      Messages: ["Messages", "Direct messages with the students you're building alongside."],
      Profile: ["Your profile", "Your major, school, interests, photos, and the links teammates use to reach you."],
      Notifications: ["Notifications", "Replies to your join requests, new connections, and events you RSVP'd to will surface here."],
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
