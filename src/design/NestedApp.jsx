/* ============================================================
   NESTED NYC — App shell, routing, state, tweaks
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { NestedData, CAT, isProjectAdmin, isProjectOwner } from './data'
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
import { orgService } from '../services/orgService'
import { eventService } from '../services/eventService'
import { storageService } from '../services/storageService'
import { toDbProfile, fromDbProfile, dataUrlToFile } from './profileAdapter'
import { projectService, closeRole } from '../services/projectService'
import { toDbProject, fromDbProject, creatorTeamMember } from './projectAdapter'
import { toPerson } from './peopleAdapter'
import { rankPeople } from './peopleRank'
import { enrichConversations, upsertMessage, mergeThread, bumpInboxRow } from './messageAdapter'
import { connectionService } from '../services/connectionService'
import { messageService, newId } from '../services/messageService'
import { parse as parseLocation, build as buildPath, accessOf, validateNext, titleFor, describeFor } from './router'

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

  const LS = "nested.nyc.v1";
  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
  }

  // Project ids whose view was already recorded this browser session (per-tab,
  // survives reloads). Applies to guests AND signed-in users — for the
  // signed-in the server still dedupes per day; this just skips pointless RPCs.
  const VIEWED_SS = "nested.nyc.viewed.v1";

  const NAV = [
    { id: "discover", label: "Discover", icon: "grid" },
    { id: "events",   label: "Events",   icon: "calendar" },
    { id: "people",   label: "People",   icon: "users" },
  ];

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const persisted = useRef(loadState());
    if (!persisted.current.joinedAt) persisted.current.joinedAt = Date.now();
    const viewedThisSession = useRef(null); // lazy Set, hydrated from sessionStorage

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
    const [profile, setProfile] = useState(persisted.current.profile || null);
    const [detailId, setDetailId] = useState(bootParams.detailId || null);
    const [editId, setEditId] = useState(bootParams.editId || null);
    // True until the first hydrateSession resolves — lets deep-linked gated
    // screens hold a skeleton instead of crashing on a null profile/org.
    const [sessionPending, setSessionPending] = useState(() => isSupabaseConfigured());
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
    const [inbox, setInbox] = useState([]);
    // Peers I've blocked (id Set), hydrated from messageService.getMyBlocks().
    // Block is DM-only — it gates new DMs both ways but keeps the connection +
    // profile; the thread/profile read this to render Block vs Unblock.
    const [blocked, setBlocked] = useState(new Set());
    // Open DM thread: messages for the active peer (chronological), its load
    // status, and the peer's display identity (name/avatar/handle).
    const [thread, setThread] = useState([]);
    const [threadStatus, setThreadStatus] = useState("loading");
    const [threadPeer, setThreadPeer] = useState(null);
    // Load-older pagination: whether an older page may exist + an in-flight flag.
    const [threadHasMore, setThreadHasMore] = useState(false);
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    // The per-conversation Realtime broadcast channel for live read receipts (and
    // a natural home for typing later). { ch, peerId } — see the dm-receipts effect.
    const dmReceiptRef = useRef(null);
    // Failed/unsent optimistic messages stashed per peerId so a thread switch
    // doesn't lose the user's typed text + picked files (re-merged on reopen).
    const pendingByPeerRef = useRef(new Map());
    // Self-scoped read-sync broadcast channel (dm-readsync:<myId>) so reading a
    // thread in one tab clears its unread badge in this user's other tabs live.
    const readSyncRef = useRef(null);
    // Latest auto-retry fn (a ref so the realtime effect's resync can call it with
    // fresh state) — re-sends transient-failed sends in the open thread on reconnect.
    const autoRetryRef = useRef(null);
    // Ids the user Removed while a send/retry might still be in flight — the deliver
    // success path checks this so a racing success can't resurrect a discarded bubble.
    const discardedRef = useRef(new Set());
    const [pendingRequests, setPendingRequests] = useState([]);
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
    // Deep-linked /projects/:id (view or edit) that isn't in the loaded feed:
    // "loading" while projectService.getProject resolves it, "missing" when it
    // doesn't exist / isn't visible to this viewer. "idle" otherwise.
    const [detailFetch, setDetailFetch] = useState("idle");
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
    // Starts true: a deep-linked /dashboard/events/:id/edit must not bounce in
    // the one render between orgAccount landing and the loader effect firing.
    // Only read in org context, so the idle-true for students is inert.
    const [orgEventsLoading, setOrgEventsLoading] = useState(true);
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
    const [toasts, setToasts] = useState([]);
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
    const [confirmBlock, setConfirmBlock] = useState(null); // {id, handle, name} pending block, or null
    const [confirmDelete, setConfirmDelete] = useState(null); // {id, handle, name} pending delete-conversation, or null
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
    // Which form the auth screen opens on. "Sign up" / gated actions → signup;
    // the guest "Log in" button → signin (a returning user shouldn't see signup).
    // /login and /signup pin it from the URL.
    const [authMode, setAuthMode] = useState((boot && !boot.authCallback && boot.state && boot.state.authMode) || "signup");
    // Send a guest to the auth screen in a given mode. Used by the top-bar
    // Log in / Sign up buttons; gated actions go through requireAuth (signup).
    // Both remember where the user stood (returnTo) so finishing auth lands
    // them back there; from the home board the stash is cleared instead —
    // landing on the post-signup default beats replaying a stale destination.
    const goAuth = (mode) => {
      stashReturnTo(window.location.pathname !== "/" ? window.location.pathname : null);
      setAuthMode(mode); setRoute("onboarding"); window.scrollTo({ top: 0 });
    };

    // persist — a light identity cache only: {profile, joinedAt}. Position
    // (route/ids) now lives in the URL; reopening bare nested.social lands on
    // Discover by design.
    useEffect(() => {
      localStorage.setItem(LS, JSON.stringify({
        profile,
        joinedAt: persisted.current.joinedAt,
      }));
    }, [profile]);

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
    const bootWriteRef = useRef(true);    // first URL write replaces the boot entry
    const replaceNextRef = useRef(false); // one-shot: next write is replaceState
    const applyingPopRef = useRef(false); // one-shot: state just came FROM the URL — don't echo it back
    const authCallbackRef = useRef(boot && boot.authCallback ? { kind: boot.kind, next: boot.next } : null);
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

    // Latest profile/orgAccount for the popstate listener + applyParsed: the
    // listener binds once (mount) and must read current auth state without
    // re-subscribing; hydrateSession also writes these refs synchronously so
    // its own applyParsed call can't see a stale value.
    const profileRef = useRef(profile);
    useEffect(() => { profileRef.current = profile; }, [profile]);
    const orgAccountRef = useRef(orgAccount);
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

    function toast(text, icon) {
      const id = Math.random().toString(36).slice(2);
      setToasts((arr) => [...arr, { id, text, icon }]);
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 2800);
    }

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

    // Latest projects list, for realtime handlers below: they subscribe once per
    // session and must read the current projects without re-binding the channel.
    const projectsRef = useRef([]);
    useEffect(() => { projectsRef.current = projects; }, [projects]);

    // Which peer's DM thread is open right now (or null). The realtime handler +
    // resync below subscribe once per session, so they read the open peer from
    // this ref rather than re-binding the channel. Driven imperatively by the
    // thread-fetch effect (not a [route, threadPeer] sync effect) so it never
    // lags the open conversation — a one-tick lag would let a ping splice the
    // previous peer's messages into the new thread.
    const openPeerIdRef = useRef(null);

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

    // ─── REALTIME: direct messages ──────────────────────────────────────────
    // A second self-scoped channel for DMs. The INSERT row's body is ciphertext
    // (Option B — encrypted at rest), so realtime is only a PING: we never read
    // the payload body, we refetch through the decrypting RPC, which is the
    // source of truth. If the sender's thread is open we merge the message in;
    // otherwise we refresh the inbox (unread badge + decrypted preview). On a
    // reconnect (a repeat SUBSCRIBED after a drop) or tab refocus we resync both,
    // so anything missed while the socket was down isn't lost. Self-sends never
    // echo here (the filter is recipient_id=me), and the refetches dedup by id,
    // so there are no duplicate bubbles. No-op in mock mode.
    useEffect(() => {
      if (!profile || !profile.id || !isSupabaseConfigured() || !supabase) return;
      let channel;
      let readChannel = null;
      let cancelled = false;
      let subscribedOnce = false;
      // Coalesce bursts: while a refetch is in flight, mark it dirty and fire
      // exactly once more on completion — N rapid pings collapse to ≤2 RPCs per
      // stream, and the last (freshest) fetch always wins.
      let inboxInFlight = false, inboxDirty = false;
      let threadInFlight = false, threadDirty = false;

      async function refetchInbox() {
        if (inboxInFlight) { inboxDirty = true; return; }
        inboxInFlight = true;
        try {
          const { data } = await messageService.getInbox();
          if (cancelled || !data) return;
          const open = openPeerIdRef.current;   // never resurrect the badge on the thread you're reading
          setInbox(open ? data.map((r) => (r.peerId === open ? { ...r, unreadCount: 0 } : r)) : data);
        } finally {
          inboxInFlight = false;
          if (inboxDirty && !cancelled) { inboxDirty = false; refetchInbox(); }
        }
      }

      async function refetchOpenThread() {
        const pid = openPeerIdRef.current;
        if (!pid) return;
        if (threadInFlight) { threadDirty = true; return; }
        threadInFlight = true;
        try {
          const { data } = await messageService.getThread(pid);
          if (cancelled || !data) return;
          if (openPeerIdRef.current !== pid) return;   // switched threads mid-fetch → drop this result
          setThread((cur) => mergeThread(cur, data.slice().reverse()));
          pruneDeliveredFromStash(pid, data);   // an id now delivered is no longer "failed" — drop any stale stash copy so it can't resurrect
          messageService.markThreadRead(pid);
          signalRead(pid, data[0] && data[0].createdAt);   // live "Seen" to the sender (server time)
          signalReadSync(pid);   // clear this peer's unread in my other tabs
          const newest = data[0];   // get_thread is newest-first
          if (newest) setInbox((rows) => bumpInboxRow(rows, pid,
            { lastBody: newest.body, lastAt: newest.createdAt, lastFromMe: newest.fromMe, read: true, lastHasAttachment: !!(newest.attachments && newest.attachments.length) }));
        } finally {
          threadInFlight = false;
          // Re-fire for whichever thread is open now (not the stale pid): a ping
          // that landed mid-fetch — possibly after a peer switch — must still be
          // serviced. refetchOpenThread re-reads the peer and re-guards post-await.
          if (threadDirty && !cancelled && openPeerIdRef.current) { threadDirty = false; refetchOpenThread(); }
        }
      }

      async function resync() { await refetchInbox(); await refetchOpenThread(); if (autoRetryRef.current) autoRetryRef.current(); }
      function onVisible() { if (document.visibilityState === "visible") resync(); }

      (async () => {
        const { data } = await authService.getSession();
        if (cancelled) return;
        const token = data && data.session && data.session.access_token;
        if (token) await supabase.realtime.setAuth(token);
        if (cancelled) return;
        channel = supabase
          .channel("dm-self-" + profile.id)
          .on("postgres_changes", {
            event: "INSERT", schema: "public", table: "messages",
            filter: "recipient_id=eq." + profile.id,
          }, (payload) => {
            const senderId = payload.new && payload.new.sender_id;   // body_enc is ciphertext — never read it
            if (senderId && senderId === openPeerIdRef.current) refetchOpenThread();
            else refetchInbox();
          })
          .subscribe((status) => {
            // A repeat SUBSCRIBED = the socket dropped and rejoined → resync to
            // pull anything missed. Errors/timeouts: let the client auto-rejoin.
            if (status === "SUBSCRIBED") { if (subscribedOnce) resync(); subscribedOnce = true; }
          });
        // Cross-tab read-sync: when THIS user reads a thread in another tab, that
        // tab broadcasts here so we clear the same peer's unread badge live.
        readChannel = supabase.channel("dm-readsync:" + profile.id, { config: { broadcast: { self: false } } });
        readChannel.on("broadcast", { event: "read" }, ({ payload }) => {
          const pid = payload && payload.peerId;
          if (pid) setInbox((rows) => rows.map((r) => (r.peerId === pid ? { ...r, unreadCount: 0 } : r)));
        });
        readChannel.subscribe();
        readSyncRef.current = readChannel;
      })();

      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", resync);   // browser regained connectivity → pull missed messages + auto-retry transient-failed sends
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", resync);
        if (channel) supabase.removeChannel(channel);
        if (readChannel) supabase.removeChannel(readChannel);
        readSyncRef.current = null;
      };
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

    // Load the open thread on /messages/:username: resolve the handle to a peer
    // (in-memory People list first, else fetch by username), fetch the
    // conversation (get_thread is newest-first → reverse to chronological), then
    // mark it read and clear this peer's unread from the inbox badge.
    useEffect(() => {
      openPeerIdRef.current = null;   // no thread open until one resolves below (also clears on nav away)
      if (route !== "messageThread" || !messageThreadHandle || !profile || !profile.id) return;
      if (!isSupabaseConfigured()) { setThreadStatus("error"); return; }
      const wanted = messageThreadHandle.toLowerCase();
      let cancelled = false;
      (async () => {
        setThreadStatus("loading");
        setThread([]);   // drop the previous peer's bubbles before merging this one's (URL/popstate path doesn't clear)
        setThreadHasMore(false);   // reset pagination for the new peer
        let peer = (threadPeer && threadPeer.handle && threadPeer.handle.toLowerCase() === wanted) ? threadPeer : null;
        if (!peer) {
          const found = people.find((p) => p.handle && p.handle.toLowerCase() === wanted);
          if (found) peer = { id: found.id, handle: found.handle, name: found.name, avatar: found.avatar };
        }
        if (!peer) {
          const { data } = await profileService.getByUsername(messageThreadHandle);
          if (cancelled) return;
          if (data) { const p = toPerson(data); peer = { id: p.id, handle: p.handle, name: p.name, avatar: p.avatar }; }
        }
        if (cancelled) return;
        if (!peer || !peer.id) { setThreadStatus("missing"); return; }
        setThreadPeer(peer);
        openPeerIdRef.current = peer.id;   // realtime pings for this peer now refetch into the open thread
        const { data: msgs, error } = await messageService.getThread(peer.id);
        if (cancelled) return;
        if (error) { setThreadStatus("error"); return; }
        setThread((cur) => mergeThread(cur, (msgs || []).slice().reverse()));   // merge, not replace — a ping mid-load isn't clobbered
        pruneDeliveredFromStash(peer.id, msgs);   // drop stash entries already delivered so they can't re-overwrite a confirmed bubble as "failed"
        // Restore any genuinely failed/unsent bubbles stashed for this peer (a failed
        // send before a thread switch) so the user can still see + retry them.
        const stashed = pendingByPeerRef.current.get(peer.id);
        if (stashed && stashed.length) setThread((cur) => mergeThread(cur, stashed));
        setThreadStatus("ready");
        setThreadHasMore((msgs || []).length >= 50);   // a full page back → there may be older messages
        messageService.markThreadRead(peer.id);
        signalRead(peer.id, (msgs && msgs[0]) ? msgs[0].createdAt : null);   // tell the peer their messages are now seen (server time)
        signalReadSync(peer.id);   // clear this peer's unread in my other tabs
        setInbox((rows) => rows.map((r) => (r.peerId === peer.id ? { ...r, unreadCount: 0 } : r)));
      })();
      return () => { cancelled = true; };
    }, [route, messageThreadHandle, profile && profile.id]);

    // ─── Live read receipts (broadcast) ─────────────────────────────────────
    // A per-conversation broadcast channel carries an ephemeral "I've read up to
    // <t>" ping so the SENDER's bubbles flip to "Seen" instantly — without
    // streaming DB UPDATEs (the messages publication stays INSERT-only). The
    // persistent read_at remains the source of truth for unread counts; this is
    // purely live UI. Keyed to the sorted id-pair so both participants share one
    // channel. Modular: delete this block and "Seen" simply falls back to
    // updating on the next thread refetch — nothing else breaks.
    useEffect(() => {
      if (route !== "messageThread" || !threadPeer || !threadPeer.id || !profile || !profile.id || !isSupabaseConfigured() || !supabase) return;
      const peerId = threadPeer.id;
      const pair = [profile.id, peerId].slice().sort().join(":");
      const ch = supabase.channel("dm-receipts:" + pair, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "read" }, ({ payload }) => {
        if (!payload || payload.by !== peerId) return;
        const at = payload.at;
        setThread((t) => t.map((m) => (m.fromMe && !m.readAt && (!at || m.createdAt <= at)) ? { ...m, readAt: at || new Date().toISOString() } : m));
      });
      ch.subscribe();
      dmReceiptRef.current = { ch, peerId };
      return () => { dmReceiptRef.current = null; supabase.removeChannel(ch); };
    }, [route, threadPeer && threadPeer.id, profile && profile.id]);

    // ─── Session hydration ──────────────────────────────────────
    // Called on mount AND after the forgot-password flow completes, so a
    // fresh session is routed the same way as a returning session. Cached
    // localStorage profile renders instantly while this runs.
    //
    // The URL wins: hydration re-parses the CURRENT location at resolve time
    // (popstate may have moved us mid-await) and only corrects it when the
    // session's role can't occupy it — every correction is a replaceState via
    // applyParsed, never a new history entry. The old "org owners always land
    // on the dashboard" force-route survives ONLY for `/`. A /auth/* boot
    // (Supabase email link) is routed here too, then authCallbackRef unfreezes
    // the URL mirror.
    async function hydrateSession(shouldAbort) {
      if (!isSupabaseConfigured()) { setSessionPending(false); return; } // offline / no env — local-only mode
      const aborted = () => shouldAbort && shouldAbort();

      const sessRes = await authService.getSession();
      if (aborted()) return;
      const session = sessRes && sessRes.data && sessRes.data.session;

      const here = parseLocation(window.location.pathname, window.location.search);
      const cb = authCallbackRef.current || (here && here.authCallback ? here : null);
      const finish = () => {
        authCallbackRef.current = null;
        setSessionPending(false);
      };

      if (!session) {
        // No live session — guest mode. Wipe any stale cached profile.
        if (persisted.current.profile) {
          setProfile(null);
          profileRef.current = null;
          try { localStorage.removeItem(LS); } catch (e) {}
        }
        if (cb) {
          // An email link that produced no session is dead (expired/used).
          toast("That link has expired — sign in to continue", "x");
          authCallbackRef.current = null;
          window.history.replaceState({ nested: { eventViewFrom: "events" } }, "", "/");
          applyParsed({ route: "discover", params: {}, state: {} }, {});
          return finish();
        }
        // Guest: the URL wins. Gated URLs gate inside applyParsed
        // (stash returnTo → auth wall, bar replaced with /signup).
        applyParsed(here, { replace: true });
        return finish();
      }

      // Branch on account_type: an authed user is either a student (has
      // profiles.onboarding_completed=true) or an org owner (owns a row in
      // organizations). We check org-ownership first because it's the
      // stronger signal: profile rows exist for all auth users, but only
      // org admins own an org.
      const myOrgs = await orgService.getMyOrgs();
      if (aborted()) return;
      let ownedOrg = (myOrgs.data && myOrgs.data[0]) || null;
      if (ownedOrg) {
        // Resolve campus → UNI slug for the dashboard flyer echo (color + logo);
        // the DB row carries university_id, not a uni slug.
        let orgUni = null;
        if (ownedOrg.type === 'university' && NestedData.UNI[ownedOrg.slug]) {
          orgUni = ownedOrg.slug;
        } else if (ownedOrg.university_id) {
          const { data: unis } = await orgService.listUniversities();
          if (aborted()) return;
          const parent = (unis || []).find((u) => u.id === ownedOrg.university_id);
          if (parent && NestedData.UNI[parent.slug]) orgUni = parent.slug;
        }
        ownedOrg = { ...ownedOrg, uni: orgUni };
        setOrgAccount(ownedOrg);
        orgAccountRef.current = ownedOrg; // applyParsed below must see it NOW
        if (cb) {
          const target = cb.next ? parseLocation(cb.next, "") : null;
          authCallbackRef.current = null;
          applyParsed(target || { route: "orgDashboard", params: {}, state: {} }, { replace: true });
          return finish();
        }
        applyParsed(here, { replace: true });
        return finish();
      }

      const { data: row, error } = await profileService.getCurrentProfile();
      if (aborted()) return;

      if (error || !row || !row.onboarding_completed) {
        // Signed-in user with no profile AND no org → either a fresh org
        // signup that hasn't created its org row yet (send to orgOnboarding)
        // or a student mid-onboarding. We can't distinguish reliably from
        // the row alone, so check user metadata. Any deep link they carried
        // is stashed so finishing onboarding returns them to it.
        if (cb && cb.next) {
          stashReturnTo(cb.next);
        } else if (here && !here.authCallback && accessOf(here.route) !== "anon") {
          stashReturnTo(window.location.pathname);
        }
        const metaAcct = session.user && session.user.user_metadata && session.user.user_metadata.account_type;
        authCallbackRef.current = null;
        replaceNextRef.current = true;
        if (metaAcct === "org_admin") {
          setRoute("orgOnboarding");
        } else {
          setAuthMode("signup");
          setRoute("onboarding");
        }
        return finish();
      }

      const sessUser = session.user || {};
      const hydrated = fromDbProfile(row, sessUser.email);
      setProfile(hydrated);
      profileRef.current = hydrated; // applyParsed below must see it NOW
      if (cb) {
        // Fresh session out of an email link: validated ?next= wins, then any
        // same-tab returnTo stash, then home.
        const target = (cb.next && parseLocation(cb.next, "")) || null;
        const ret = !target && takeReturnTo();
        authCallbackRef.current = null;
        applyParsed(target || (ret && parseLocation(ret, "")) || { route: "discover", params: {}, state: {} }, { replace: true });
        return finish();
      }
      // Student: the URL wins (own /u/<handle> upgrades to /profile inside
      // applyParsed; anon/org URLs bounce home there too — which also covers a
      // student who signed in via the org door: applyParsed sees access==="anon"
      // for /org/signup and redirects to discover, so they never land in org
      // onboarding).
      applyParsed(here, { replace: true });
      return finish();
    }

    useEffect(() => {
      let cancelled = false;
      hydrateSession(() => cancelled);

      // React to auth changes fired from anywhere.
      const sub = authService.onAuthStateChange((event, session) => {
        // Keep the Realtime socket's JWT fresh. A channel sets it once when it
        // subscribes, but the token expires (~1h) while the socket is long-lived,
        // so on every refresh we re-push it — otherwise live delivery (DMs,
        // join approvals) goes quiet on a long-open tab until the next
        // reconnect/refocus resync. App-wide: one call covers every channel.
        if (session && session.access_token && supabase) {
          supabase.realtime.setAuth(session.access_token);
        }
        if (event === "SIGNED_OUT") {
          setProfile(null);
          try { localStorage.removeItem(LS); } catch (e) {}
          setRoute("discover"); // back to guest browsing, not the auth wall
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
        // uploadProfilePhoto derives the storage extension from this filename,
        // so it has to track the dataURL's actual encoding (WebP vs JPEG).
        const ext = src.startsWith("data:image/webp") ? "webp" : "jpg";
        const file = await dataUrlToFile(src, "photo-" + i + "." + ext);
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

      // Photos replaced or cleared by this save leave their old objects behind
      // (every upload gets a unique Date.now() name, so nothing is overwritten).
      // Delete them now that the upsert succeeded — fire-and-forget, scoped to
      // this user's own folder; a failed delete just leaves a stale file.
      try {
        const marker = "/storage/v1/object/public/avatars/";
        const keep = new Set(
          (hydrated.photos || []).map((p) => p && p.src).filter(Boolean)
        );
        ((profile && profile.photos) || [])
          .map((p) => (typeof p === "string" ? p : p && p.src))
          .filter((src) => src && !keep.has(src) && src.includes(marker))
          .forEach((src) => {
            const path = decodeURIComponent(src.split(marker)[1] || "");
            if (path.startsWith(userId + "/")) {
              storageService.deleteAvatar(path).then(({ error }) => {
                if (error) console.error("Stale photo cleanup failed:", error);
              });
            }
          });
      } catch (err) {
        console.error("Stale photo cleanup failed:", err);
      }

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
      setInbox([]);
      setThread([]);
      setThreadPeer(null);
      setBlocked(new Set());
      pendingByPeerRef.current = new Map();
      discardedRef.current = new Set();
      setOrgAccount(null);
      setOrgEvents([]);
      setEventDraftId(null);
      setDetailId(null);
      setEditId(null);
      setRoute("discover"); // land on guest browsing, not the sign-up wall
      try { localStorage.removeItem(LS); } catch (e) {}
      toast("Signed out", "check");
    }

    // Sign-out runs behind a confirm — the header chip and the mobile sheet both
    // route here instead of calling signOut() directly.
    function requestSignOut() { setNotifOpen(false); setAcctOpen(false); setSheetOpen(false); setConfirmSignOut(true); }
    function confirmSignOutNow() { setConfirmSignOut(false); signOut(); }

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
      const proj = projectsList.find((p) => p.id === id);
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
    // Owner-only: promote a crew member into projects.admins (co-lead) or
    // demote them. Co-leads can edit the flyer / post updates / run the join
    // inbox, but only the OWNER may change the admins list itself — the DB
    // enforces that with the projects_guard_ownership trigger; this check is
    // the client-side mirror. Optimistic; the failure path undoes THIS toggle
    // against current state (never restores a whole snapshot, which would
    // clobber other crew ops that landed in between).
    async function setCoLead(projectId, userId, make) {
      const prev = projectsList.find((p) => p.id === projectId);
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
    // Owner-only: remove a crew member entirely. ONE call — deleting the
    // team_members row also revokes any co-lead grant atomically via the
    // team_members_revoke_admin DB trigger, so there's no two-step partial
    // state to manage. Optimistic; failure re-inserts THIS member against
    // current state rather than restoring a stale snapshot.
    async function kickMember(projectId, userId) {
      const prev = projectsList.find((p) => p.id === projectId);
      if (!prev || !isProjectOwner(prev, profile)) {
        toast("Only the owner can remove crew", "x");
        return;
      }
      if (!userId || userId === prev.ownerId) return;
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
    // Connections: optimistic add/remove with revert-on-failure (mirrors
    // toggleSave). People is controlled — it owns no connection state.
    // connect() treats a duplicate (23505) as success and a 0-row delete is a
    // no-op, so redundant calls are harmless.
    async function onConnect(id) {
      if (!profile) return requireAuth("Sign in to connect with students");
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
    // Block is DM-only: the server gate stops new DMs both ways, but the
    // connection + profile stay and unblock fully restores messaging. Optimistic
    // Set update with revert-on-failure (mirrors onConnect). Block runs behind a
    // confirm; unblock is non-destructive, so it's immediate.
    function requestBlock(peer) {
      if (!profile) return requireAuth("Sign in to manage messages");
      if (!peer || !peer.id) return;
      setConfirmBlock({ id: peer.id, handle: peer.handle, name: peer.name });
    }
    async function blockPeerNow() {
      const peer = confirmBlock;
      setConfirmBlock(null);
      if (!peer || !peer.id) return;
      setBlocked((s) => new Set(s).add(peer.id));
      toast("Blocked" + (peer.handle ? " @" + peer.handle : ""), "block");
      if (!isSupabaseConfigured()) return;
      const { error } = await messageService.blockUser(peer.id);
      if (error) {
        setBlocked((s) => { const n = new Set(s); n.delete(peer.id); return n; });
        toast("Couldn't block — " + (error.message || "try again"), "x");
      }
    }
    async function unblockPeer(peer) {
      if (!peer || !peer.id) return;
      setBlocked((s) => { const n = new Set(s); n.delete(peer.id); return n; });
      toast("Unblocked" + (peer.handle ? " @" + peer.handle : ""), "check");
      if (!isSupabaseConfigured()) return;
      const { error } = await messageService.unblockUser(peer.id);
      if (error) {
        setBlocked((s) => new Set(s).add(peer.id));
        toast("Couldn't unblock — " + (error.message || "try again"), "x");
      }
    }
    // Delete conversation (S8) is delete-FOR-ME: the server sets a per-user clear
    // watermark, so the thread leaves my inbox/thread while the peer keeps their
    // copy, and it reappears if they message me again. Behind a confirm (it hides
    // history); optimistic inbox removal + leave the thread, revert on failure.
    function requestDeleteConversation(peer) {
      if (!profile) return requireAuth("Sign in to manage messages");
      if (!peer || !peer.id) return;
      setConfirmDelete({ id: peer.id, handle: peer.handle, name: peer.name });
    }
    async function deleteConversationNow() {
      const peer = confirmDelete;
      setConfirmDelete(null);
      if (!peer || !peer.id) return;
      const prevInbox = inbox;   // snapshot for revert-on-failure
      setInbox((rows) => rows.filter((r) => r.peerId !== peer.id));
      if (route === "messageThread") { setThread([]); setRoute("messages"); window.scrollTo({ top: 0 }); }
      pendingByPeerRef.current.delete(peer.id);   // drop any failed/unsent bubbles for this peer so they can't resurrect on reopen
      toast("Conversation deleted", "check");
      if (!isSupabaseConfigured()) return;
      const { error } = await messageService.deleteConversation(peer.id);
      if (error) {
        setInbox(prevInbox);
        toast("Couldn't delete — " + (error.message || "try again"), "x");
      }
    }
    function goNav(id) {
      // People & Saved need an account — nudge guests to sign in instead.
      if (!profile && (id === "people" || id === "saved")) {
        return requireAuth(id === "people" ? "Sign in to meet other students" : "Sign in to save projects");
      }
      if (id === "discover" || id === "events" || id === "people" || id === "saved") { setRoute(id); }
      else { setSoonLabel(NAV.find((n) => n.id === id).label); setRoute("soon"); }
      window.scrollTo({ top: 0 });
    }
    async function toggleRsvp(id) {
      if (!profile) return requireAuth("Sign in to RSVP");
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

    // Open a 1:1 thread. `target` is an inbox conversation ({peerId,handle,…}) or
    // a person ({id,handle,…}); both normally carry a handle (peers are
    // connections → in the People list). The handle drives the URL; the thread
    // effect resolves it to the peer id for get_thread. The rare no-handle case
    // (peer absent from People) resolves via getPublicProfile first.
    function openThread(target) {
      if (!profile) return requireAuth("Sign in to message");
      if (!target) return;
      const pid = target.id || target.peerId;
      if (!pid) return;
      const go = (peer) => {
        setThreadPeer(peer);
        setMessageThreadHandle(peer.handle);
        setThread([]);
        setThreadStatus("loading");
        setRoute("messageThread");
        window.scrollTo({ top: 0 });
      };
      if (target.handle) {
        go({ id: pid, handle: target.handle, name: target.name || "Student", avatar: target.avatar || null });
        return;
      }
      if (!isSupabaseConfigured()) { toast("Couldn't open that conversation", "x"); return; }
      profileService.getPublicProfile(pid).then(({ data }) => {
        if (!data || !data.username) { toast("Couldn't open that conversation", "x"); return; }
        const p = toPerson(data);
        go({ id: p.id, handle: p.handle, name: p.name, avatar: p.avatar });
      });
    }

    // Optimistic send: append a pending bubble immediately (client-supplied id),
    // then reconcile it with the stored row on confirm (same id) or drop it on
    // failure. Also refresh this peer's inbox row so the list stays correct
    // without a refetch (live sync is S6).
    function sendThreadMessage(body, files = []) {
      const peer = threadPeer;
      const text = (body || "").trim();
      const list = Array.isArray(files) ? files : [];
      if (!peer || !peer.id || (!text && !list.length)) return;
      deliverThreadMessage(newId(), peer, text, list);
    }
    // Re-send a failed message with the SAME id (idempotent server-side). Reuses
    // the original File objects AND any attachments that already uploaded on the
    // first attempt (m._metas) so the retry doesn't re-upload them.
    function retryThreadMessage(m) {
      if (!m || !m.id || !threadPeer) return;
      setThread((t) => t.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)));
      // Mark the stash entry in-flight (_autoRetried) so a concurrent reconnect
      // auto-retry can't ALSO re-send the same id while this manual retry is pending.
      // If this attempt re-fails, fail() rebuilds the entry with _autoRetried:false,
      // re-arming one automatic retry on the next reconnect.
      const inflight = (pendingByPeerRef.current.get(threadPeer.id) || []).map((x) => (x.id === m.id ? { ...x, _autoRetried: true } : x));
      pendingByPeerRef.current.set(threadPeer.id, inflight);
      deliverThreadMessage(m.id, threadPeer, m.body || "", m._files || [], m._metas || null);
    }
    // Remove a FAILED (optimistic, never-persisted) message from the thread + the
    // per-peer stash. Guarded to failed bubbles ONLY — a delivered message can never
    // be removed here, and its bubble never renders the Remove control.
    function discardFailedMessage(m) {
      if (!m || !m.id || !m.failed) return;
      discardedRef.current.add(m.id);   // if a send/retry for this id is mid-flight, its success must not resurrect the bubble
      (m.attachments || []).forEach((a) => { if (a && a.url && a.url.startsWith("blob:")) { try { URL.revokeObjectURL(a.url); } catch (e) {} } });
      setThread((t) => t.filter((x) => x.id !== m.id));
      const peerId = threadPeer && threadPeer.id;
      if (peerId) {
        const arr = (pendingByPeerRef.current.get(peerId) || []).filter((x) => x.id !== m.id);
        if (arr.length) pendingByPeerRef.current.set(peerId, arr); else pendingByPeerRef.current.delete(peerId);
      }
    }
    // A message whose id now appears as a CONFIRMED (delivered) server row is no
    // longer "failed" — drop any stale per-peer stash entry for it so a false-failure
    // (committed server-side, but the HTTP response was lost) can't resurrect a
    // delivered message as a "Failed to send" bubble on the next thread reopen.
    function pruneDeliveredFromStash(peerId, serverRows) {
      if (!peerId) return;
      const arr = pendingByPeerRef.current.get(peerId);
      if (!arr || !arr.length) return;
      const delivered = new Set((serverRows || []).map((r) => r && r.id));
      const next = arr.filter((x) => !delivered.has(x.id));
      if (next.length === arr.length) return;
      if (next.length) pendingByPeerRef.current.set(peerId, next); else pendingByPeerRef.current.delete(peerId);
    }
    // Auto-retry on reconnect/refocus (called from the realtime resync): re-send the
    // OPEN thread's TRANSIENT-failed bubbles ONCE. The idempotent id + reused
    // _files/_metas mean a re-send can't duplicate; _autoRetried gates it to a single
    // attempt so a flapping network can't loop. Permanent failures (rate-limit /
    // blocked / validation) are skipped — they stay as manual Retry.
    function autoRetryFailed() {
      const peer = threadPeer;
      if (!peer || !peer.id || openPeerIdRef.current !== peer.id) return;
      const targets = (pendingByPeerRef.current.get(peer.id) || []).filter((m) => m.failed && m._autoRetryable && !m._autoRetried && !discardedRef.current.has(m.id));
      for (const m of targets) {
        const arr = (pendingByPeerRef.current.get(peer.id) || []).map((x) => (x.id === m.id ? { ...x, _autoRetried: true } : x));
        pendingByPeerRef.current.set(peer.id, arr);
        setThread((t) => t.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true, _autoRetried: true } : x)));
        deliverThreadMessage(m.id, peer, m.body || "", m._files || [], m._metas || null, { autoRetried: true });
      }
    }
    autoRetryRef.current = autoRetryFailed;   // keep the ref on the latest closure so resync sees fresh thread state
    // Shared send pipeline (first attempt + retry): optimistic pending bubble →
    // upload any attachments to Storage → send_message → reconcile or mark failed.
    // A failed send is STASHED per peer (pendingByPeerRef) so its text + files
    // survive a thread switch and re-merge on reopen. `preMetas` (retry only) are
    // attachment rows that already uploaded, so we skip re-uploading them.
    async function deliverThreadMessage(id, peer, text, files, preMetas, opts) {
      const at = new Date().toISOString();
      const fileList = files || [];
      const optimisticAtts = fileList.map((f) => ({
        name: f.name, mime: f.type, size: f.size,
        url: (f.type || "").startsWith("image/") ? URL.createObjectURL(f) : null,
      }));
      const blobUrls = optimisticAtts.map((a) => a.url).filter((u) => u && u.startsWith("blob:"));
      // A retry mints fresh preview blob URLs; free the PRIOR attempt's stashed ones
      // for this id so each retry doesn't leak an object URL.
      const prior = (pendingByPeerRef.current.get(peer.id) || []).find((x) => x.id === id);
      if (prior) (prior.attachments || []).forEach((a) => { if (a && a.url && a.url.startsWith("blob:")) { try { URL.revokeObjectURL(a.url); } catch (e) {} } });
      const optimisticRow = { id, peerId: peer.id, fromMe: true, body: text, createdAt: at, readAt: null, pending: true, failed: false, attachments: optimisticAtts, _files: fileList };
      setThread((t) => upsertMessage(t, optimisticRow));
      if (!isSupabaseConfigured()) return;

      // Mark failed, keep the bubble (its preview blob URL stays alive for retry),
      // and stash it under this peer so a thread switch doesn't lose it. keepMetas
      // is passed ONLY when every attachment already uploaded (the SEND failed) so
      // a retry can skip re-uploading; an upload failure forces a full re-upload.
      // keepMetas: passed only on a SEND failure (all uploads done) so a retry can
      // skip re-uploading. err drives auto-retry classification: a TRANSIENT failure
      // (network / no SQLSTATE / PT500 server fault) is eligible for one automatic
      // retry on reconnect; PERMANENT ones (PT401/403/422/429 — auth, blocked,
      // validation, rate-limit) stay manual-only.
      const fail = (keepMetas, err) => {
        const autoRetryable = !err || !err.code || err.code === "PT500";
        const failedRow = { ...optimisticRow, pending: false, failed: true, _metas: keepMetas, _autoRetryable: autoRetryable, _autoRetried: !!(opts && opts.autoRetried) };
        setThread((t) => t.map((m) => (m.id === id ? failedRow : m)));
        const map = pendingByPeerRef.current;
        const arr = (map.get(peer.id) || []).filter((x) => x.id !== id);
        arr.push(failedRow);
        map.set(peer.id, arr);
      };

      // Upload attachments first (own-folder Storage write), unless a retry already
      // carries them. A per-file index keeps same-named files from colliding.
      let metas = Array.isArray(preMetas) ? preMetas : [];
      if (!metas.length && fileList.length) {
        for (let i = 0; i < fileList.length; i++) {
          const { data: meta, error: upErr } = await messageService.uploadAttachment(fileList[i], id, i);
          if (upErr) { fail(undefined, upErr); toast(upErr.message || "Couldn't upload that file", "x"); return; }
          metas.push(meta);
        }
      }

      const { data, error } = await messageService.sendMessage(peer.id, text, id, metas);
      if (error) { fail(metas, error); toast(error.message || "Couldn't send message", "x"); return; }
      // Success: drop the per-peer stash entry and free the optimistic blob URLs.
      const map = pendingByPeerRef.current;
      const left = (map.get(peer.id) || []).filter((x) => x.id !== id);
      if (left.length) map.set(peer.id, left); else map.delete(peer.id);
      blobUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} });
      // The user tapped Remove on this bubble while the send was mid-flight: honor it
      // (don't resurrect the bubble locally) even though it reached the server.
      if (discardedRef.current.has(id)) { discardedRef.current.delete(id); return; }
      // Only reconcile the OPEN thread's bubbles if we're still on this peer — a
      // mid-send peer switch (setThread([]) ran for the new peer) must not splice
      // this confirmed message into another conversation. The inbox bump is keyed
      // by peer.id, so it stays correct regardless of what's open.
      if (openPeerIdRef.current === peer.id) {
        setThread((t) => upsertMessage(t, { ...data, pending: false, failed: false }));
      }
      setInbox((rows) => bumpInboxRow(rows, peer.id, { lastBody: text, lastAt: data.createdAt, lastFromMe: true, read: true, lastHasAttachment: metas.length > 0 }));
    }
    // Fetch an older page of the open thread (keyset on the oldest confirmed
    // message) and prepend it. hasMore stays true while a full page comes back.
    async function loadEarlierThread() {
      if (loadingEarlier || !threadPeer || !threadPeer.id) return;
      const oldest = thread.find((m) => !m.pending && !m.failed);
      if (!oldest) return;
      setLoadingEarlier(true);
      const { data, error } = await messageService.getThread(threadPeer.id, oldest.createdAt, 50);
      setLoadingEarlier(false);
      if (error) { toast("Couldn't load earlier messages", "x"); return; }
      const older = (data || []).slice().reverse();   // newest-first → chronological
      if (openPeerIdRef.current === threadPeer.id) setThread((cur) => mergeThread(cur, older));
      setThreadHasMore((data || []).length >= 50);
    }
    // Live read-receipt signal — tell the open peer "I've read up to now" so their
    // sent bubbles flip to "Seen" instantly (the dm-receipts broadcast channel).
    function signalRead(peerId, at) {
      const c = dmReceiptRef.current;
      if (c && c.peerId === peerId && c.ch && profile) {
        // `at` is the newest SERVER created_at the reader has loaded (not a client
        // wall clock) so the sender's createdAt<=at gate compares server-time to
        // server-time — clock skew can't suppress the Seen flip. Null → flip all.
        c.ch.send({ type: "broadcast", event: "read", payload: { by: profile.id, at: at || null } });
      }
    }
    // Tell THIS user's OTHER tabs a thread was just read so their unread badge for
    // that peer clears live (the dm-self stream is INSERT-only — a read in one tab
    // is otherwise invisible to siblings until the next hydration/focus).
    function signalReadSync(peerId) {
      const ch = readSyncRef.current;
      if (ch && peerId) { try { ch.send({ type: "broadcast", event: "read", payload: { peerId } }); } catch (e) {} }
    }

    async function submitModal(text, role) {
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
      // role = the specific open role the applicant picked (or "" when the project
      // has no open roles / a single one was auto-targeted by the modal).
      const { error } = await projectService.joinProject(proj.id, role || "", text || "");
      if (error) {
        setRequested((r) => { const n = new Set(r); n.delete(proj.id); return n; });
        toast("Request didn't send — " + (error.message || "try again"), "x");
      }
    }

    const projectsList = projects;
    // Incoming connections the user hasn't reciprocated yet — drives the bell dot.
    const incomingPending = incoming.filter((p) => !connected.includes(p.id));
    // Inbox rows joined with the People list for each peer's display identity
    // (see enrichConversations in messageAdapter). unreadMessages drives the
    // header chat dot + mobile badge.
    const conversations = enrichConversations(inbox, people);
    const unreadMessages = inbox.reduce((n, r) => n + (r.unreadCount || 0), 0);
    // "My projects" = the ones I own OR co-lead (a promoted co-lead runs the
    // flyer too), derived from the discover list (all my flyers publish to
    // discover). Drives the profile's pinned-projects rail.
    const myProjects = profile ? projectsList.filter((p) => isProjectAdmin(p, profile)) : [];
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
          joinedAt: (profile && profile.joinedAt) || persisted.current.joinedAt,
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
