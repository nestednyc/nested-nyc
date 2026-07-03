/* ============================================================
   NESTED NYC — App shell, routing, state, tweaks
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { NestedData, CAT, isProjectAdmin } from './data'
import { Av, Toasts, Stamp, Skeleton, ConfirmModal } from './shared'
import { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle } from './tweaks-panel'
import Onboarding from './onboarding'
import ForgotPassword from './forgot'
import Discover, { ProjectCard } from './discover'
import Events from './events'
import Matches from './matches'
import People, { ContactLinks } from './people'
import UserProfile from './userProfile'
import Notifications from './notifications'
import Messages from './messages'
import MessageThread from './messageThread'
import { NotifPanel, AccountPanel } from './headerMenus'
import ProjectDetail from './detail'
import Profile from './profile'
import Create from './create'
import Edit from './edit'
import OrgSignup from './orgSignup'
import OrgOnboard from './orgOnboard'
import OrgDashboard from './orgDashboard'
import OrgEdit from './orgEdit'
import OrgView from './orgView'
import EventForm from './eventForm'
import EventDetail from './eventDetail'
import { SHOW_TWEAKS } from '../config/features'
import { isSupabaseConfigured, authService, supabase } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { eventService } from '../services/eventService'
import { projectService } from '../services/projectService'
import { fromDbProject } from './projectAdapter'
import { toPerson } from './peopleAdapter'
import { rankPeople } from './peopleRank'
import { connectionService } from '../services/connectionService'
import { messageService } from '../services/messageService'
import { parse as parseLocation, build as buildPath, accessOf, validateNext, titleFor, describeFor } from './router'
import { useToasts } from './hooks/useToasts'
import { useSession } from './hooks/useSession'
import { usePeople } from './hooks/usePeople'
import { useMessaging } from './hooks/useMessaging'
import { useProjects } from './hooks/useProjects'
import { useEvents } from './hooks/useEvents'
import { useOrg } from './hooks/useOrg'

  const { useState, useEffect, useRef } = React;

  // A profile's "pfp" is just its first uploaded photo. Photos arrive as either
  // bare URL strings or { src } objects (see profileAdapter); return the first
  // non-empty one — the same rule peopleAdapter uses to derive everyone else's
  // avatar. null → Av falls back to initials.
  function firstPhotoUrl(photos) {
    if (!Array.isArray(photos)) return null;
    for (const p of photos) {
      const url = typeof p === "string" ? p : (p && p.src);
      if (url) return url;
    }
    return null;
  }

  // Head sync helpers — the client mirror of api/prerender.js. The URL-mirror
  // effect calls these every commit (next to document.title) so Googlebot's JS
  // render and in-app navigations keep a correct description / canonical. They
  // patch tags that already exist in index.html, and create them if missing.
  function setHeadMeta(selector, attr, key, content) {
    let el = document.head.querySelector(selector);
    if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", content);
  }
  function setMetaName(name, content) { setHeadMeta('meta[name="' + name + '"]', "name", name, content); }
  function setMetaProp(prop, content) { setHeadMeta('meta[property="' + prop + '"]', "property", prop, content); }
  function setCanonical(href) {
    let el = document.head.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
    el.setAttribute("href", href);
  }

  // Avatar initials for the signed-in user's own handle. Usernames currently
  // carry a leading "@", so the generic word-split initials would surface that
  // "@" — strip it and take the first two real letters (the 2nd/3rd characters
  // while the "@" prefix exists). Stays correct if the "@" is ever dropped.
  function handleInitials(username) {
    return String(username || "").replace(/^@+/, "").slice(0, 2).toUpperCase();
  }

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

  const NAV = [
    { id: "discover", label: "Discover", icon: "grid" },
    { id: "events",   label: "Events",   icon: "calendar" },
    { id: "people",   label: "People",   icon: "users" },
  ];

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

    // ─── Boot parse: the URL owns the initial position ──────────────────────
    // parse() → {route, params, state} | {authCallback, kind, next} | null.
    // The boot NEVER role-gates: the cached localStorage blob can't identify
    // org owners (their `profile` is null), so gated screens render skeletons
    // until hydrateSession re-parses and corrects (replaceState, sub-second).
    // A Supabase email link (/auth/*) boots as a discover skeleton with the
    // callback stashed in authCallbackRef; supabase-js consumes the
    // #access_token hash itself and hydration routes the fresh session.
    const urlBootRef = useRef(undefined);
    if (urlBootRef.current === undefined) {
      urlBootRef.current = parseLocation(window.location.pathname, window.location.search);
    }
    const boot = urlBootRef.current;
    const bootParams = (boot && !boot.authCallback && boot.params) || {};
    const [route, setRoute] = useState(boot && !boot.authCallback ? boot.route : "discover");
    const [detailId, setDetailId] = useState(bootParams.detailId || null);
    const [editId, setEditId] = useState(bootParams.editId || null);
    // /u/:username — the handle on the userProfile route. Set by openProfile
    // (in-app navigation) or the boot/popstate URL parse (deep link).
    const [profileViewUsername, setProfileViewUsername] = useState(bootParams.profileViewUsername || null);
    // /messages/:username — the peer handle on the open thread. Set by openThread
    // (in-app) or the boot/popstate URL parse (deep link), mirrors profileViewUsername.
    const [messageThreadHandle, setMessageThreadHandle] = useState(bootParams.messageThreadHandle || null);
    // One-shot: set when a student finishes onboarding so we land on their own
    // profile in edit mode (to nudge them to fill it out). Profile clears it via
    // onAutoEditConsumed, so a normal later visit stays read-only. Not persisted.
    const [profileEditOnArrive, setProfileEditOnArrive] = useState(false);
    // Start true when a Supabase hydration is actually coming (returning user with
    // a persisted profile) so the first paint is a skeleton, not a flash of the
    // empty state. The early-return below resolves it to false otherwise.
    // Skeleton-first whenever Supabase is configured: both a returning user and a
    // guest fetch on mount (the guest gets the public Discover feed), so paint a
    // skeleton, not an empty-state flash. Mock mode (unconfigured) loads nothing.
    const [projectsLoading, setProjectsLoading] = useState(() => isSupabaseConfigured());
    // Surface hydration error + retry. loadErrors is { discover, people, saved }
    // (each a Supabase error or undefined) so each page shows its own error
    // state; retrySurface bumps reloadNonce, which the loader effect depends on.
    const [loadErrors, setLoadErrors] = useState(null);
    const [reloadNonce, setReloadNonce] = useState(0);
    const retrySurface = () => setReloadNonce((n) => n + 1);
    const [eventDraftId, setEventDraftId] = useState(bootParams.eventDraftId || null);
    // Student-side org-profile navigation. Populated when a student clicks an
    // event's host pill; the orgView route loads the org by slug and renders
    // a public OrgProfile around it. Distinct from orgAccount (an authed org
    // owner, who manages from the dashboard — owners have no public-page view).
    const [orgViewSlug, setOrgViewSlug] = useState(bootParams.orgViewSlug || null);
    // The event the student is currently inspecting. Set by openEventDetail
    // from any of the feed surfaces (events tab, org public page, org view).
    // Cleared when leaving the route. Past/owner/anon variants are all
    // resolved inside the EventDetail screen.
    const [eventViewId, setEventViewId] = useState(bootParams.eventViewId || null);
    // Where the user came from when opening an event, so Back goes home cleanly:
    // "events" (default) or "orgView" (came from a host's public page).
    // Rides history.state per entry, so a reload restores it too.
    const [eventViewFrom, setEventViewFrom] = useState(() => {
      const st = window.history.state;
      return (st && st.nested && st.nested.eventViewFrom) || "events";
    });
    const [query, setQuery] = useState("");
    const [soonLabel, setSoonLabel] = useState("Events");
    const [modal, setModal] = useState(null); // {type:'join'|'contact', project, lead}
    const [justVerified, setJustVerified] = useState(false);
    // Email seed for the forgot-password screen, populated when the user
    // clicks "Forgot password?" from the signin step so they don't retype it.
    const [forgotEmailSeed, setForgotEmailSeed] = useState("");
    // Which auth screen opened forgot-password ("onboarding" | "orgSignup"),
    // so its Back button returns an org to the org door, not the student wall.
    const [forgotFrom, setForgotFrom] = useState("onboarding");
    // Which form the org auth screen opens on. Set to "signin" when an org
    // backs out of forgot-password (they left the sign-in form; OrgSignup
    // remounts across routes, so the mode must arrive as a prop); reset to
    // "signup" whenever the org auth flow exits.
    const [orgAuthMode, setOrgAuthMode] = useState("signup");
    // Mobile-only chrome state (≤860px): the account sheet behind the avatar, and
    // the collapsible top-bar search. Both are inert on desktop — their only
    // triggers live in the mobile-only top-bar cluster, which is display:none above
    // the breakpoint — so this state never changes the desktop view.
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mSearchOpen, setMSearchOpen] = useState(false);

    // Desktop header dropdowns (topbar bell + account chip) and the sign-out
    // confirm. Inert on mobile — the triggers live in .topbar-desk (display:none
    // ≤860px); mobile uses the account sheet instead.
    const [notifOpen, setNotifOpen] = useState(false);
    const [acctOpen, setAcctOpen] = useState(false);
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    // Which form the auth screen opens on. "Sign up" / gated actions → signup;
    // the guest "Log in" button → signin (a returning user shouldn't see signup).
    // /login and /signup pin it from the URL.
    const [authMode, setAuthMode] = useState((boot && !boot.authCallback && boot.state && boot.state.authMode) || "signup");

    // ─── Mirror + identity refs ─────────────────────────────────────────────
    // Declared ABOVE the domain-hooks block on purpose: hook injection lists
    // evaluate these identifiers at call time, so they must be initialized
    // first (TDZ). The write-side mirror effect that consumes the one-shot
    // flags lives below, unchanged.
    const bootWriteRef = useRef(true);    // first URL write replaces the boot entry
    const replaceNextRef = useRef(false); // one-shot: next write is replaceState
    const applyingPopRef = useRef(false); // one-shot: state just came FROM the URL — don't echo it back
    const authCallbackRef = useRef(boot && boot.authCallback ? { kind: boot.kind, next: boot.next } : null);
    // Latest profile/orgAccount for the popstate listener + applyParsed: the
    // listener binds once (mount) and must read current auth state without
    // re-subscribing; hydrateSession also writes these refs synchronously so
    // its own applyParsed call can't see a stale value. Seeded null rather
    // than from state: nothing reads them before the first effect flush —
    // popstate binds in an effect and hydrateSession awaits getSession()
    // first — and the sync effects below the mirror keep them current.
    const profileRef = useRef(null);
    const orgAccountRef = useRef(null);

    // ─── Domain hooks ───────────────────────────────────────────────────────
    // Toasts, session/identity, and the whole DM/messaging domain live in
    // hooks/ — NestedApp stays the composition root: it injects the
    // cross-domain deps and wires the returns into the same screens/props as
    // before. Hydration setters (setInbox/setBlocked) come back out solely for
    // the initial-hydration Promise.all below; signOut composes signOutAuth +
    // each domain's reset*.
    const { toasts, toast } = useToasts();
    const {
      profile, setProfile, orgAccount, setOrgAccount, sessionPending, joinedAt,
      hydrateSession, saveProfileToSupabase, signOutAuth,
    } = useSession({
      applyParsed, authCallbackRef, replaceNextRef, profileRef, orgAccountRef,
      stashReturnTo, takeReturnTo, setAuthMode, setRoute, toast,
      onSignedOut: () => setRoute("discover"), // back to guest browsing, not the auth wall
    });
    const {
      people, setPeople, connected, setConnected, incoming, setIncoming,
      incomingPending, onConnect, onDisconnect, resetPeople,
    } = usePeople({ profile, toast, requireAuth });
    const {
      inbox, setInbox, blocked, setBlocked, conversations, unreadMessages,
      thread, threadStatus, threadPeer, threadHasMore, loadingEarlier,
      confirmBlock, setConfirmBlock, confirmDelete, setConfirmDelete,
      openThread, sendThreadMessage, retryThreadMessage, discardFailedMessage,
      loadEarlierThread, requestBlock, blockPeerNow, unblockPeer,
      requestDeleteConversation, deleteConversationNow, resetMessaging,
    } = useMessaging({
      profile, people, route, setRoute,
      messageThreadHandle, setMessageThreadHandle,
      toast, requireAuth,
    });
    const {
      projects, setProjects, saved, setSaved, joined, setJoined,
      requested, setRequested, rejected, setRejected,
      projectRequests, setProjectRequests, pendingRequests,
      detailFetch, myProjects, detailProject,
      openProject, openEdit, toggleSave, submitJoinRequest,
      updateProjectStatus, setCoLead, kickMember, approveRequest, rejectRequest,
      createProject, saveProjectEdits, deleteProjectById, resetProjects,
    } = useProjects({
      profile, route, detailId, editId, projectsLoading,
      setDetailId, setEditId, setRoute, toast, requireAuth,
    });
    const { rsvped, setRsvped, toggleRsvp, resetEvents } = useEvents({ profile, toast, requireAuth });
    const {
      orgEvents, orgEventsLoading, createOrgEvent, updateOrgEvent, resetOrg,
    } = useOrg({ orgAccount, toast, setRoute, setEventDraftId });

    // Dismiss whichever dropdown is open on outside-click / Escape.
    useEffect(() => {
      if (!notifOpen && !acctOpen) return;
      const close = () => { setNotifOpen(false); setAcctOpen(false); };
      const onDown = (e) => { if (!(e.target.closest && e.target.closest(".hdr-anchor"))) close(); };
      const onKey = (e) => { if (e.key === "Escape") close(); };
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    }, [notifOpen, acctOpen]);
    // Send a guest to the auth screen in a given mode. Used by the top-bar
    // Log in / Sign up buttons; gated actions go through requireAuth (signup).
    // Both remember where the user stood (returnTo) so finishing auth lands
    // them back there; from the home board the stash is cleared instead —
    // landing on the post-signup default beats replaying a stale destination.
    const goAuth = (mode) => {
      stashReturnTo(window.location.pathname !== "/" ? window.location.pathname : null);
      setAuthMode(mode); setRoute("onboarding"); window.scrollTo({ top: 0 });
    };

    // ─── URL mirror (write side) ────────────────────────────────────────────
    // The `route` state machine stays the source of truth; this effect mirrors
    // it into the address bar + tab title (router.js is the pure codec). The
    // read side — boot parse and popstate — coordinates through these refs so
    // neither side echoes the other back.
    //
    // NO dependency array — it must run on EVERY commit. The one-shot flags
    // are armed synchronously in handlers that also set state, so the next
    // commit is the one they describe and consuming them up front keeps them
    // exact. With a dep array, an applyParsed that re-applies the current
    // route (setRoute bails, deps never change) would leave a flag armed until
    // an unrelated navigation — which would then silently replace instead of
    // push, eating a history entry. Per-run cost is a string compare + title
    // set; writes only happen when the built path actually differs.
    useEffect(() => {
      const replaceArmed = bootWriteRef.current || replaceNextRef.current;
      bootWriteRef.current = false;
      replaceNextRef.current = false;
      const popApplying = applyingPopRef.current;
      applyingPopRef.current = false;

      const dp = detailId ? projects.find((p) => p.id === detailId) : null;
      const headCtx = {
        authMode,
        detailTitle: dp && dp.title ? dp.title.split(" — ")[0] : null,
        detailBlurb: dp && dp.blurb ? dp.blurb : null,
        username: profileViewUsername,
        orgSlug: orgViewSlug,
        threadName: messageThreadHandle,
      };
      const pageTitle = titleFor(route, headCtx);
      const pageDesc = describeFor(route, headCtx);
      document.title = pageTitle;
      setMetaName("description", pageDesc);
      setMetaProp("og:title", pageTitle);
      setMetaProp("og:description", pageDesc);
      // Booted on a Supabase email link: supabase-js owns the URL (it strips
      // its #access_token hash) until hydrateSession routes us and clears this.
      if (authCallbackRef.current) return;
      const path = buildPath(route, {
        detailId, editId, eventViewId, orgViewSlug, profileViewUsername,
        eventDraftId, authMode, orgSlug: orgAccount && orgAccount.slug,
        messageThreadHandle,
      });
      if (path === null) return; // soon / params not ready — leave the URL alone
      // Canonical + og:url mirror the path the effect just built — correct for
      // every route at zero extra cost (set before popstate's early return).
      setCanonical(window.location.origin + path);
      setMetaProp("og:url", window.location.origin + path);
      if (popApplying) return;   // the URL already shows this state
      const stateObj = { nested: { eventViewFrom } };
      if (path === window.location.pathname) {
        // Same path — just keep the entry's eventViewFrom fresh (no new entry).
        const st = window.history.state;
        if (!st || !st.nested || st.nested.eventViewFrom !== eventViewFrom) {
          window.history.replaceState(stateObj, "", path + window.location.search);
        }
        return;
      }
      window.history[replaceArmed ? "replaceState" : "pushState"](stateObj, "", path);
    });

    // Keep the mirror-side identity refs (declared above the domain-hooks
    // block) tracking the live state.
    useEffect(() => { profileRef.current = profile; }, [profile]);
    useEffect(() => { orgAccountRef.current = orgAccount; }, [orgAccount]);

    // returnTo: where to land after auth, surviving the email round-trip via
    // sessionStorage (and ?next= on the emailRedirectTo for new-tab links).
    // Always re-validated at consumption — never trust a stored path.
    const RETURN_TO_SS = "nested.nyc.returnTo.v1";
    function stashReturnTo(path) {
      // null clears: an auth entry from the home board carries no destination,
      // and a stale one from an abandoned gate must not steer this sign-in.
      try {
        if (path) sessionStorage.setItem(RETURN_TO_SS, path);
        else sessionStorage.removeItem(RETURN_TO_SS);
      } catch (e) {}
    }
    function peekReturnTo() {
      let v = null;
      try { v = sessionStorage.getItem(RETURN_TO_SS); } catch (e) {}
      return validateNext(v);
    }
    function takeReturnTo() {
      let v = null;
      try {
        v = sessionStorage.getItem(RETURN_TO_SS);
        sessionStorage.removeItem(RETURN_TO_SS);
      } catch (e) {}
      return validateNext(v);
    }

    // Apply a parsed URL (boot correction, popstate, or hydration) to the
    // state machine, role-gating via accessOf. Corrections clear the pop
    // suppression and arm a replace, so the bar is fixed without stacking a
    // history entry. Sets ONLY the params the target route owns — stale params
    // stay put on purpose (edit-cancel needs detailId; renders are
    // route-gated, so leftovers are inert).
    function applyParsed(parsed, opts) {
      const me = profileRef.current;
      const org = orgAccountRef.current;
      const p = (parsed && !parsed.authCallback && parsed.route && parsed) || { route: "discover", params: {}, state: {} };
      const target = p.route;
      const params = p.params || {};

      const redirect = (r) => {
        applyingPopRef.current = false; // a correction must write the bar
        replaceNextRef.current = true;
        setRoute(r);
        window.scrollTo({ top: 0 });
      };

      const access = accessOf(target);
      if (!me && !org && (access === "student" || access === "org")) {
        // Guest on a gated URL: remember the destination, show the auth wall.
        stashReturnTo(buildPath(target, {
          detailId: params.detailId, editId: params.editId, eventViewId: params.eventViewId,
          orgViewSlug: params.orgViewSlug, profileViewUsername: params.profileViewUsername,
          eventDraftId: params.eventDraftId, messageThreadHandle: params.messageThreadHandle,
        }));
        toast("Sign in to see that page", "sparkle");
        setAuthMode("signup");
        return redirect("onboarding");
      }
      if (org) {
        // Org accounts live in the dashboard subtree. Their own slug + any
        // student/anon/home URL go to the dashboard; other public surfaces
        // (events, projects, other orgs) stay.
        if (target === "orgView" && params.orgViewSlug === org.slug) {
          return redirect("orgDashboard");
        }
        if (access === "student" || access === "anon" || target === "discover") {
          return redirect("orgDashboard");
        }
      } else if (access === "org") {
        return redirect("discover"); // student on an org-only URL
      } else if (me && access === "anon") {
        return redirect("discover"); // already signed in — no auth screens
      }
      if (me && target === "userProfile" && me.username && params.profileViewUsername &&
          params.profileViewUsername.toLowerCase() === String(me.username).toLowerCase()) {
        return redirect("profile"); // own handle → own profile page
      }

      if (target === "detail") setDetailId(params.detailId);
      if (target === "edit") setEditId(params.editId);
      if (target === "eventDetail") setEventViewId(params.eventViewId);
      if (target === "orgView") setOrgViewSlug(params.orgViewSlug);
      if (target === "userProfile") setProfileViewUsername(params.profileViewUsername);
      if (target === "messageThread") setMessageThreadHandle(params.messageThreadHandle);
      if (target === "eventEdit") setEventDraftId(params.eventDraftId);
      if (p.state && p.state.authMode) setAuthMode(p.state.authMode);
      if (opts && opts.replace) replaceNextRef.current = true;
      setRoute(target);
    }

    // ─── URL mirror (read side): Back/Forward ───────────────────────────────
    useEffect(() => {
      function onPop(e) {
        const { pathname, search } = window.location;
        // A /auth/* entry resurfacing in history is a dead callback — replace
        // it with home directly (no state may change, so fix the bar here).
        if (pathname === "/auth" || pathname.indexOf("/auth/") === 0) {
          window.history.replaceState({ nested: { eventViewFrom: "events" } }, "", "/");
          applyParsed({ route: "discover", params: {}, state: {} }, {});
          return;
        }
        const st = e.state;
        setEventViewFrom((st && st.nested && st.nested.eventViewFrom) || "events");
        applyingPopRef.current = true;
        applyParsed(parseLocation(pathname, search), {});
      }
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }, []);

    // Guests browse freely but can't act. Every write/identity action funnels
    // through here: a one-line nudge + the sign-up screen. (EventDetail's RSVP
    // already used this onSignIn pattern; this generalizes it to every gate.)
    function requireAuth(msg) {
      stashReturnTo(window.location.pathname !== "/" ? window.location.pathname : null);
      toast(msg || "Sign up to continue", "sparkle");
      setAuthMode("signup");
      setRoute("onboarding");
      window.scrollTo({ top: 0 });
    }

    // Hydrate the student's project surface from Supabase once signed in.
    // Supabase is the source of truth; localStorage no longer caches these.
    // Mirrors the orgEvents loader above. Keyed on the user id so it runs once
    // per session, not on every profile field edit.
    useEffect(() => {
      if (!isSupabaseConfigured()) { setProjectsLoading(false); return; }

      // Guest (no profile): hydrate ONLY the public Discover feed. Every other
      // read below is user-scoped (saved/joined/requested/people/connections/…)
      // and needs a session, so we skip them. Signing in flips profile.id and
      // re-runs this effect down the authenticated path.
      if (!profile || !profile.id) {
        let cancelled = false;
        setProjectsLoading(true);
        setLoadErrors(null);
        projectService.getDiscoverProjects().then(({ data, error }) => {
          if (cancelled) return;
          setProjects(((data) || []).map(fromDbProject));
          setLoadErrors({ discover: error });
          setProjectsLoading(false);
        }).catch((err) => {
          if (cancelled) return;
          console.error('Guest discover hydration failed:', err);
          setLoadErrors({ discover: err });
          setProjectsLoading(false);
        });
        return () => { cancelled = true; };
      }

      let cancelled = false;
      setProjectsLoading(true);
      setLoadErrors(null);
      (async () => {
        try {
          const [disc, savedRes, joinedRes, requestedRes, rejRes, rsvpRes, peopleRes, connRes, incomingRes, reqInboxRes, inboxRes, blocksRes] = await Promise.all([
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
            messageService.getInbox(),
            messageService.getMyBlocks(),
          ]);
          if (cancelled) return;
          setProjects(((disc && disc.data) || []).map(fromDbProject));
          setSaved(new Set(((savedRes && savedRes.data) || []).map((p) => p.id)));
          setJoined(new Set(((joinedRes && joinedRes.data) || []).map((p) => p.id)));
          setRequested(new Set(((requestedRes && requestedRes.data) || []).map((p) => p.id)));
          setRejected(new Set(((rejRes && rejRes.data) || []).map((p) => p.id)));
          setRsvped(new Set(((rsvpRes && rsvpRes.data) || []).map((e) => e.id)));
          // Rank raw rows relative to the viewer (relevance + profile
          // completeness) BEFORE adapting — see peopleRank.js. Ranking the raw
          // rows keeps the exact university/skills/fields that toPerson drops.
          setPeople(rankPeople(
            ((peopleRes && peopleRes.data) || [])
              .filter((r) => r.id !== profile.id && r.account_type !== "org_admin"),
            profile
          ).map(toPerson));
          setConnected(((connRes && connRes.data) || []).map((t) => t.id));
          setIncoming(((incomingRes && incomingRes.data) || [])
            .filter((r) => r.account_type !== "org_admin")
            .map(toPerson));
          setProjectRequests((reqInboxRes && reqInboxRes.data) || []);
          setInbox((inboxRes && inboxRes.data) || []);
          setBlocked(new Set(((blocksRes && blocksRes.data) || [])));
          // Surface per-page load errors so each page can show its own retry.
          setLoadErrors({
            discover: disc && disc.error,
            people: (peopleRes && peopleRes.error) || (incomingRes && incomingRes.error),
            saved: (savedRes && savedRes.error) || (joinedRes && joinedRes.error) || (requestedRes && requestedRes.error) || (rejRes && rejRes.error),
            notifications: (incomingRes && incomingRes.error) || (reqInboxRes && reqInboxRes.error),
            messages: inboxRes && inboxRes.error,
          });
        } catch (err) {
          // A thrown (rejected) service strands no state: log it and mark every
          // surface errored so the user gets a retry instead of a blank page.
          if (!cancelled) {
            console.error('Project surface hydration failed:', err);
            setLoadErrors({ discover: err, people: err, saved: err, notifications: err, messages: err });
          }
        } finally {
          if (!cancelled) setProjectsLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [profile && profile.id, reloadNonce]);

    // The cross-domain sign-out composer: useSession owns the auth slice
    // (Supabase session, profile/orgAccount identity, cached LS blob); every
    // other domain contributes its reset*; the router-param clears are
    // root-owned and must stay listed here explicitly.
    async function signOut() {
      await signOutAuth();
      resetProjects();    // feed + the saved/joined/requested buckets
      resetEvents();      // RSVPs
      resetPeople();      // connection edges
      resetMessaging();   // inbox, open thread + peer, block set, failed-send stash
      resetOrg();         // org event list
      setEventDraftId(null);
      setDetailId(null);
      setEditId(null);
      setRoute("discover"); // land on guest browsing, not the sign-up wall
      toast("Signed out", "check");
    }

    // Sign-out runs behind a confirm — the header chip and the mobile sheet both
    // route here instead of calling signOut() directly.
    function requestSignOut() { setNotifOpen(false); setAcctOpen(false); setSheetOpen(false); setConfirmSignOut(true); }
    function confirmSignOutNow() { setConfirmSignOut(false); signOut(); }

    function goNav(id) {
      // People & Saved need an account — nudge guests to sign in instead.
      if (!profile && (id === "people" || id === "saved")) {
        return requireAuth(id === "people" ? "Sign in to meet other students" : "Sign in to save projects");
      }
      if (id === "discover" || id === "events" || id === "people" || id === "saved") { setRoute(id); }
      else { setSoonLabel(NAV.find((n) => n.id === id).label); setRoute("soon"); }
      window.scrollTo({ top: 0 });
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

    // Navigate to a student's /u/:username page (from the People grid,
    // Notifications, a project's crew/lead, or an event's attendees).
    function openPerson(handle) {
      if (!handle) return;
      setProfileViewUsername(handle);
      setRoute("userProfile");
      window.scrollTo({ top: 0 });
    }
    // Open a teammate's profile by user id. Self → own profile page; everyone
    // else → resolve the username (loaded People list first, public profile as
    // fallback) and navigate to /u/:username.
    async function openProfile(userId) {
      if (!userId) return;
      if (!profile) return requireAuth("Sign in to view student profiles");
      if (userId === profile.id) { setRoute("profile"); window.scrollTo({ top: 0 }); return; }
      const person = people.find((pp) => pp.id === userId);
      if (person && person.handle) return openPerson(person.handle);
      // Not in the loaded People list (e.g. an event attendee who hasn't
      // surfaced in browse). Resolve their handle so the click still lands.
      if (!isSupabaseConfigured()) { toast("That profile isn't available yet", "x"); return; }
      const { data: row, error } = await profileService.getPublicProfile(userId);
      if (error || !row || !row.username) { toast("That profile isn't available yet", "x"); return; }
      openPerson(row.username);
    }

    // Thin modal shim: the modal state is chrome (root-owned); the join
    // submission itself is projects-domain (useProjects.submitJoinRequest).
    function submitModal(text, role) {
      if (!modal) return;
      // Only the join flow submits; the contact modal just surfaces real links.
      if (modal.type !== "join") { setModal(null); return; }
      const proj = modal.project;
      setModal(null);
      submitJoinRequest(proj, text, role);
    }

    const projectsList = projects;
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

    // ---------- FIRST-HYDRATION HOLD ----------
    // A deep link can land on a screen whose identity hasn't resolved yet
    // (student screens crash on a null profile; org screens render against a
    // null orgAccount). While the first hydrateSession is in flight, hold a
    // skeleton instead — hydration then either fills the identity or
    // applyParsed corrects the position (replaceState, sub-second).
    const needsStudent = route === "profile" || route === "create" || route === "edit" ||
      route === "userProfile" || route === "notifications" || route === "messages" || route === "messageThread";
    const needsOrg = route === "orgDashboard" || route === "orgEditMe" ||
      route === "eventCreate" || route === "eventEdit";
    if (sessionPending && ((needsStudent && !profile) || (needsOrg && !orgAccount))) {
      return (
        React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
          React.createElement("div", { className: "discover" }, React.createElement(Skeleton, { count: 6 })),
          React.createElement(Toasts, { items: toasts })
        )
      );
    }

    // ---------- ONBOARDING (full-screen, no topbar) ----------
    if (route === "onboarding") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(Onboarding, {
            initialMode: authMode,
            returnTo: peekReturnTo(),
            onComplete: (p) => {
              setProfile(p);
              profileRef.current = p; // applyParsed below must see it NOW
              const ret = takeReturnTo();
              const target = ret && ret !== "/" ? parseLocation(ret, "") : null;
              if (target) {
                // They were headed somewhere — take them back (replacing the
                // auth entry) instead of the profile-edit nudge.
                applyParsed(target, { replace: true });
                window.scrollTo({ top: 0 });
                toast("Welcome to Nested, @" + p.username, "sparkle");
              } else {
                // The wizard now handles profile enrichment inline (name, photo,
                // skills, …), so a fresh signup lands straight on the board
                // rather than being dropped into the profile-edit page.
                setRoute("discover"); window.scrollTo({ top: 0 });
                toast("Welcome to Nested, @" + p.username, "sparkle");
              }
              setJustVerified(true);
              setTimeout(() => setJustVerified(false), 1500);
            },
            onOrgPath: () => { setRoute("orgSignup"); window.scrollTo({ top: 0 }); },
            onForgot: (seedEmail) => {
              setForgotEmailSeed(seedEmail || "");
              setForgotFrom("onboarding");
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
            onBack: () => {
              // An org abandoning the reset left the SIGN-IN form — reopen it
              // there (OrgSignup remounts, so the mode must travel as a prop).
              if (forgotFrom === "orgSignup") setOrgAuthMode("signin");
              setRoute(forgotFrom);
              window.scrollTo({ top: 0 });
            },
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
      // Any successful auth here routes by what the ACCOUNT is, not by which
      // door was used: hydrateSession sends org owners to their dashboard,
      // org_admin signups without an org row to orgOnboarding, and a student
      // who wandered in (or got their account confirmed here) to the STUDENT
      // side — never into org creation.
      const orgAuthDone = () => {
        setOrgAuthMode("signup");
        hydrateSession();
        window.scrollTo({ top: 0 });
      };
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(OrgSignup, {
            initialMode: orgAuthMode,
            initialEmail: forgotFrom === "orgSignup" ? forgotEmailSeed : "",
            onBack: () => { setOrgAuthMode("signup"); setRoute("onboarding"); },
            onForgot: (seedEmail) => {
              setForgotEmailSeed(seedEmail || "");
              setForgotFrom("orgSignup");
              setRoute("forgot");
              window.scrollTo({ top: 0 });
            },
            onSignedUp: orgAuthDone,
            onSignedIn: orgAuthDone,
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
            onSubmit: createOrgEvent,
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- EVENT EDIT (owner-only) ----------
    if (route === "eventEdit" && orgAccount && eventDraftId) {
      const draft = orgEvents.find((e) => e.id === eventDraftId);
      // Deep link: the org's events may still be loading — hold, don't bounce.
      if (!draft && orgEventsLoading) {
        return (
          React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
            React.createElement("div", { className: "discover" }, React.createElement(Skeleton, { count: 3 })),
            React.createElement(Toasts, { items: toasts })
          )
        );
      }
      if (!draft) {
        replaceNextRef.current = true; // correction, not navigation — don't stack history
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
            onSubmit: (fields) => updateOrgEvent(eventDraftId, fields),
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
            onCreate: createProject,
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- EDIT (full-screen, no topbar) ----------
    if (route === "edit") {
      const editProject = projectsList.find((p) => p.id === editId);
      // Guard: the project may still be cold-loading (deep link) — hold a
      // skeleton; bounce only once the feed AND the by-id fetch have settled.
      if (!editProject) {
        if (projectsLoading || detailFetch === "loading") {
          return (
            React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
              React.createElement("div", { className: "discover" }, React.createElement(Skeleton, { count: 3 })),
              React.createElement(Toasts, { items: toasts })
            )
          );
        }
        replaceNextRef.current = true; // correction, not navigation — don't stack history
        setEditId(null);
        setRoute(detailId ? "detail" : "discover");
        return null;
      }
      // Ownership lock: the real gate. Even if a non-admin reaches this route
      // (stale editId, hand-edited localStorage), refuse to render the editor.
      if (!isProjectAdmin(editProject, profile)) {
        replaceNextRef.current = true;
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
            onSave: saveProjectEdits,
            onDelete: deleteProjectById,
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- ORG APP SHELL (dashboard + own public page) ----------
    if (orgAccount && (route === "orgDashboard" || route === "eventDetail")) {
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
              }, React.createElement(Icon, { name: "grid", size: 18 }), "Dashboard")
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
            onSignOut: signOut,
          }),

          // Org owner viewing the public side of one of their own events.
          // EventDetail detects isOwner via orgAccount.id === event.organization_id
          // and swaps the RSVP CTA for "Edit event" → eventEdit.
          route === "eventDetail" && eventViewId && React.createElement(EventDetail, {
            eventId: eventViewId,
            profile,
            rsvped,
            orgAccount,
            onBack: () => { setEventViewId(null); setRoute("orgDashboard"); },
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
            profile && React.createElement("button", {
              className: "iconbtn", onClick: () => { setRoute("messages"); window.scrollTo({ top: 0 }); }, title: "Messages",
            },
              React.createElement(Icon, { name: "chat", size: 20 }),
              unreadMessages > 0 && React.createElement("span", { className: "dot" })
            ),
            profile && React.createElement("div", { className: "hdr-anchor" },
              React.createElement("button", {
                className: "iconbtn" + (notifOpen ? " on" : ""),
                onClick: () => { setAcctOpen(false); setNotifOpen((v) => !v); },
                title: "Notifications", "aria-haspopup": "menu", "aria-expanded": notifOpen ? "true" : "false",
              },
                React.createElement(Icon, { name: "bell", size: 20 }),
                (incomingPending.length + projectRequests.length) > 0 && React.createElement("span", { className: "dot" })
              ),
              React.createElement(NotifPanel, {
                open: notifOpen,
                count: incomingPending.length + projectRequests.length,
                incoming: incomingPending,
                projectRequests,
                loading: projectsLoading,
                onApprove: approveRequest,
                onReject: rejectRequest,
                onConnect,
                onOpenProfile: (p) => openPerson(p.handle),
                onOpenProject: openProject,
                onViewAll: () => { setRoute("notifications"); window.scrollTo({ top: 0 }); },
                onClose: () => setNotifOpen(false),
              })
            ),
            profile && justVerified && React.createElement("span", {
              className: "corner-stamp enter",
              title: "@" + profile.username + " · verified .edu student",
            }, React.createElement(Stamp, { size: 44 })),
            profile && React.createElement("div", { className: "hdr-anchor" },
              React.createElement("button", {
                className: "me-chip" + (acctOpen ? " on" : ""),
                onClick: () => { setNotifOpen(false); setAcctOpen((v) => !v); },
                "aria-haspopup": "menu", "aria-expanded": acctOpen ? "true" : "false",
              },
                React.createElement(Av, { name: profile.username, img: firstPhotoUrl(profile.photos), label: handleInitials(profile.username) }),
                React.createElement("span", { className: "who" },
                  React.createElement("b", null, "@" + profile.username),
                  React.createElement("small", null, (NestedData.UNI[profile.uni] || {}).name)
                )
              ),
              React.createElement(AccountPanel, {
                open: acctOpen,
                profile,
                photoUrl: firstPhotoUrl(profile.photos),
                avLabel: handleInitials(profile.username),
                uniName: (NestedData.UNI[profile.uni] || {}).name,
                onViewProfile: () => { setRoute("profile"); window.scrollTo({ top: 0 }); },
                onEditProfile: () => { setProfileEditOnArrive(true); setRoute("profile"); window.scrollTo({ top: 0 }); },
                onViewSaved: () => goNav("saved"),
                onSignOut: requestSignOut,
                onClose: () => setAcctOpen(false),
              })
            ),
            // Guest: no account chip — offer Log in (signin) / Sign up (signup).
            !profile && React.createElement("button", { className: "btn btn-ghost", onClick: () => goAuth("signin"), title: "Log in" }, "Log in"),
            !profile && React.createElement("button", { className: "btn btn-primary", onClick: () => goAuth("signup"), title: "Create your account" },
              React.createElement(Icon, { name: "pin", size: 16, stroke: "var(--paper)" }), "Sign up")
          ),
          // Mobile-only cluster (≤860px): search toggle + avatar that opens the account sheet.
          React.createElement("div", { className: "topbar-mob" },
            React.createElement("button", { className: "iconbtn", onClick: () => setMSearchOpen((v) => !v), title: "Search", "aria-expanded": mSearchOpen ? "true" : "false" },
              React.createElement(Icon, { name: mSearchOpen ? "x" : "search", size: 20 })),
            // Chat lives in the bar (mirrors the desktop chat icon) — without it,
            // messages were buried in the account sheet with no labeled affordance.
            // Carries its OWN unread dot; the avatar dot below sheds messages so the
            // two signals are distinguishable.
            profile && React.createElement("button", {
              className: "iconbtn", onClick: () => { setRoute("messages"); window.scrollTo({ top: 0 }); }, title: "Messages", "aria-label": "Messages",
            },
              React.createElement(Icon, { name: "chat", size: 20 }),
              unreadMessages > 0 && React.createElement("span", { className: "dot" })
            ),
            profile && React.createElement("button", { className: "mob-avatar", onClick: () => setSheetOpen(true), title: "Account" },
              React.createElement(Av, { name: profile.username, img: firstPhotoUrl(profile.photos), label: handleInitials(profile.username) }),
              (incomingPending.length + projectRequests.length) > 0 && React.createElement("span", { className: "dot" })
            ),
            !profile && React.createElement("button", { className: "btn btn-primary", onClick: () => goAuth("signup"), title: "Create your account" }, "Sign up")
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
          onStart: () => { if (!profile) return requireAuth("Sign up to pin a project"); setRoute("create"); },
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
          onMessage: (person) => openThread(person),
          onOpenPerson: (person) => openPerson(person.handle),
          loading: projectsLoading,
          error: loadErrors && loadErrors.people,
          onRetry: retrySurface,
        }),

        // Student profile page (/u/:username). Self-fetches by handle; the
        // already-loaded People list seeds in-app arrivals so there's no
        // skeleton flash. Own handle never reaches here (applyParsed and
        // openProfile both upgrade it to the profile route).
        route === "userProfile" && profileViewUsername && React.createElement(UserProfile, {
          username: profileViewUsername,
          initialPerson: people.find((pp) => pp.handle && pp.handle.toLowerCase() === profileViewUsername.toLowerCase()) || null,
          connected,
          incoming,
          onConnect,
          onDisconnect,
          onMessage: (person) => openThread(person),
          onBack: () => goNav("people"),
          viewerId: profile && profile.id,
          blocked,
          onBlock: requestBlock,
          onUnblock: unblockPeer,
        }),

        route === "notifications" && React.createElement(Notifications, {
          incoming,
          connected,
          projectRequests,
          onConnect,
          onApprove: approveRequest,
          onReject: rejectRequest,
          onOpenProject: openProject,
          // Incoming connections are full toPerson objects — navigate straight
          // to their /u/:username page.
          onOpenProfile: (person) => openPerson(person.handle),
          loading: projectsLoading,
          error: loadErrors && loadErrors.notifications,
          onRetry: retrySurface,
        }),

        // Messaging is a desktop master–detail split: conversation list (left) +
        // active thread (right). Both /messages and /messages/:user render this
        // same .dm container; on mobile (≤860px) CSS shows ONE pane at a time
        // (list, or the open thread when route === messageThread → .show-thread).
        (route === "messages" || route === "messageThread") && React.createElement("div", { className: "dm" + (route === "messageThread" ? " show-thread" : "") },
          React.createElement("div", { className: "dm-list" },
            React.createElement(Messages, {
              conversations,
              loading: projectsLoading,
              error: loadErrors && loadErrors.messages,
              onRetry: retrySurface,
              onOpenThread: openThread,
              activeHandle: messageThreadHandle,
              // Per-row ⋯ menu (block / delete) — same handlers the thread used.
              blocked,
              onBlock: requestBlock,
              onUnblock: unblockPeer,
              onDelete: requestDeleteConversation,
            })
          ),
          React.createElement("div", { className: "dm-pane" },
            (route === "messageThread" && threadPeer)
              ? React.createElement(MessageThread, {
                  peer: threadPeer,
                  messages: thread,
                  status: threadStatus,
                  onSend: sendThreadMessage,
                  onBack: () => { setRoute("messages"); window.scrollTo({ top: 0 }); },
                  onOpenProfile: () => { if (threadPeer && threadPeer.handle) openPerson(threadPeer.handle); },
                  isBlocked: threadPeer ? blocked.has(threadPeer.id) : false,
                  onBlock: () => requestBlock(threadPeer),
                  onUnblock: () => unblockPeer(threadPeer),
                  onDelete: () => requestDeleteConversation(threadPeer),
                  onRetry: retryThreadMessage,
                  onDiscard: discardFailedMessage,
                  onLoadEarlier: loadEarlierThread,
                  hasMore: threadHasMore,
                  loadingEarlier,
                })
              : React.createElement("div", { className: "dm-empty" },
                  React.createElement(Icon, { name: "chat", size: 40, stroke: "var(--accent)" }),
                  React.createElement("h3", null, "Select a conversation"),
                  React.createElement("p", null, "Pick someone on the left to start chatting."))
          )
        ),

        route === "saved" && React.createElement(Matches, {
          projects: projectsList, profile,
          saved, joined, requested, rejected, onOpen: openProject, onSave: toggleSave,
          onStart: () => { if (!profile) return requireAuth("Sign up to pin a project"); setRoute("create"); },
          onBrowse: () => goNav("discover"),
          onEdit: (p) => openEdit(p.id),
          loading: projectsLoading,
          error: loadErrors && loadErrors.saved,
          onRetry: retrySurface,
        }),

        // Deep-linked detail: skeleton while the feed / by-id fetch resolves;
        // gone (or never visible) → a cork-board flavored empty state.
        route === "detail" && !detailProject && (projectsLoading || detailFetch === "loading") &&
          React.createElement("div", { className: "discover" }, React.createElement(Skeleton, { count: 3 })),
        route === "detail" && !detailProject && !projectsLoading && detailFetch !== "loading" &&
          React.createElement("div", { className: "discover" },
            React.createElement("div", { className: "match-empty fade-up" },
              React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "pin", size: 42, stroke: "var(--accent)" })),
              React.createElement("h3", null, "This flyer's not on the board"),
              React.createElement("p", null, "It may have been taken down, or the link is off. Browse the board for what's pinned right now."),
              React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: () => goNav("discover") },
                React.createElement(Icon, { name: "grid", size: 16, stroke: "var(--paper)" }), "Back to the board")
            )
          ),

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
            if (!profile) { requireAuth("Sign in to request to join"); return; }
            if (joined.has(p.id)) { toast("You're already on this team", "check"); }
            else if (requested.has(p.id)) { toast("You've already requested to join", "check"); }
            else { setModal({ type: "join", project: p }); }
          },
          onEdit: (p) => openEdit(p.id),
          onUpdateStatus: updateProjectStatus,
          onSetCoLead: setCoLead,
          onKickMember: kickMember,
          onOpenProfile: openProfile,
        }),

        route === "profile" && React.createElement(Profile, {
          profile,
          pinnedProjects: myProjects,
          projectCount: myProjects.length,
          eventCount: rsvped.size,
          connectionCount: connected.length,
          joinedAt: (profile && profile.joinedAt) || joinedAt,
          onBack: () => goNav("discover"),
          onOpenProject: openProject,
          onSaveProfile: saveProfileToSupabase,
          onSignOut: signOut,
          startInEdit: profileEditOnArrive,
          onAutoEditConsumed: () => setProfileEditOnArrive(false),
        }),

        route === "soon" && React.createElement(SoonPane, { label: soonLabel, saved, joined, requested, projects: projectsList, onOpen: openProject, onSave: toggleSave, onBack: () => goNav("discover") }),

        modal && React.createElement(Modal, { modal, onClose: () => setModal(null), onSubmit: submitModal, profile }),
        // Mobile account sheet (≤860px) — opened by the top-bar avatar; nests
        // Profile / Saved / Notifications / Sign out so the mobile bar stays minimal.
        sheetOpen && profile && React.createElement("div", { className: "sheet-scrim", onClick: () => setSheetOpen(false) },
          React.createElement("div", { className: "acct-sheet", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "acct-head" },
              React.createElement(Av, { name: profile.username, img: firstPhotoUrl(profile.photos), label: handleInitials(profile.username) }),
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
            React.createElement("button", { className: "acct-item", onClick: () => { setSheetOpen(false); setRoute("messages"); window.scrollTo({ top: 0 }); } },
              React.createElement(Icon, { name: "chat", size: 19 }), "Messages",
              unreadMessages > 0 && React.createElement("span", { className: "acct-badge" }, unreadMessages)),
            React.createElement("button", { className: "acct-item danger", onClick: requestSignOut },
              React.createElement(Icon, { name: "external", size: 19 }), "Sign out")
          )
        ),
        confirmSignOut && React.createElement(ConfirmModal, {
          accent: "var(--c-startup)",
          title: "Sign out?",
          body: "You'll need your .edu email and password to get back to your board.",
          ctaLabel: "Sign out",
          ctaIcon: "external",
          danger: true,
          onCancel: () => setConfirmSignOut(false),
          onConfirm: confirmSignOutNow,
        }),
        confirmBlock && React.createElement(ConfirmModal, {
          accent: "var(--c-startup)",
          title: "Block" + (confirmBlock.handle ? " @" + confirmBlock.handle : " this person") + "?",
          body: "New messages stop both ways until you unblock. You'll stay connected and your conversation history stays.",
          ctaLabel: "Block",
          ctaIcon: "block",
          danger: true,
          onCancel: () => setConfirmBlock(null),
          onConfirm: blockPeerNow,
        }),
        confirmDelete && React.createElement(ConfirmModal, {
          accent: "var(--c-startup)",
          title: "Delete this conversation?",
          body: "This removes it from your messages only — " + (confirmDelete.handle ? "@" + confirmDelete.handle : "the other person") + " keeps their copy. If they message you again, a new conversation starts.",
          ctaLabel: "Delete",
          ctaIcon: "trash",
          danger: true,
          onCancel: () => setConfirmDelete(null),
          onConfirm: deleteConversationNow,
        }),
        React.createElement(Toasts, { items: toasts }),
        React.createElement(StyleTweaks, { t, setTweak })
      )
    );
  }

  // ---------- Request to join / Contact modal ----------
  function Modal({ modal, onClose, onSubmit, profile }) {
    const [text, setText] = useState("");
    // JOIN: which open role the applicant targets. Default to the first open role;
    // the picker (below) only renders when there's more than one, so a single-role
    // project auto-targets it with no extra UI and zero open roles sends "".
    const joinOpenRoles = ((modal.project && modal.project.roles) || []).filter((r) => r && r.open);
    const [selectedIdx, setSelectedIdx] = useState(0);
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
            joinOpenRoles.length > 1 && React.createElement("div", { className: "join-roles", style: { marginBottom: 14 } },
              React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)", fontWeight: 600, marginBottom: 8 } }, "Which role?"),
              React.createElement("div", { className: "chips-grid" },
                joinOpenRoles.map((r, i) => {
                  const on = selectedIdx === i;
                  return React.createElement("button", {
                    key: i, type: "button",
                    className: "pick" + (on ? " on accent" : ""),
                    onClick: () => setSelectedIdx(i),
                  }, on && React.createElement(Icon, { name: "check", size: 13, width: 2.4 }), r.title);
                })
              )
            ),
            React.createElement("textarea", { placeholder, value: text, autoFocus: true, onChange: (e) => setText(e.target.value) }),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onClose }, "Cancel"),
              React.createElement("button", { className: "btn btn-primary", onClick: () => onSubmit(text, joinOpenRoles[selectedIdx] ? joinOpenRoles[selectedIdx].title : "") },
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
