/* ============================================================
   NESTED NYC — App shell, routing, state, tweaks
   ============================================================ */
import React from 'react'
import { isProjectAdmin } from './data'
import { Toasts, Skeleton, NAV } from './shared'
import { useTweaks } from './tweaks-panel'
import { ACCENTS } from './accents'
import FullScreens from './shells/FullScreens'
import OrgShell from './shells/OrgShell'
import StudentShell from './shells/StudentShell'
import { isSupabaseConfigured } from '../lib/supabase'
import { SHOW_EVENTS } from '../config/features'
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

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "surface": "cork",
    "accent": "oklch(0.60 0.185 30)",
    "displayFont": "Bricolage Grotesque",
    "texture": true,
    "tilt": true
  }/*EDITMODE-END*/;

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
    // re-subscribing. useSession owns every synchronous write — hydrateSession
    // inline, adoptProfile/adoptOrgAccount for the shells — each pairing the
    // ref with its state so an applyParsed in the same tick can't role-gate
    // against a stale value. Seeded null rather than from state: nothing
    // reads them before the first effect flush — popstate binds in an effect
    // and hydrateSession awaits getSession() first — and the sync effects
    // below the mirror keep them current.
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
      profile, orgAccount, sessionPending, joinedAt,
      adoptProfile, adoptOrgAccount,
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
      setInbox, blocked, setBlocked, conversations, unreadMessages,
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
      // While the Events tab is parked, every nav to the feed lands on the
      // board — one central redirect instead of per-call-site guards.
      if (id === "events" && !SHOW_EVENTS) id = "discover";
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
    // Everything the shells render, one flat bag: each shell destructures the
    // slice it needs at the top, so the moved JSX stays byte-identical. A new
    // screen input = a new key here.
    const api = {
      // design tokens + chrome shell
      t, setTweak, toasts, rootClass, rootStyle,
      // router state machine + params (root-owned)
      route, setRoute, goNav, goAuth, requireAuth, applyParsed,
      peekReturnTo, takeReturnTo,
      detailId, editId, setEditId,
      eventViewId, setEventViewId, eventViewFrom,
      orgViewSlug, setOrgViewSlug, profileViewUsername,
      messageThreadHandle, setEventDraftId,
      openEventDetail, openOrgView, openPerson, openProfile,
      // chrome state
      query, setQuery, soonLabel, modal, setModal, submitModal,
      justVerified, setJustVerified,
      forgotEmailSeed, setForgotEmailSeed, forgotFrom, setForgotFrom,
      orgAuthMode, setOrgAuthMode, authMode,
      sheetOpen, setSheetOpen, mSearchOpen, setMSearchOpen,
      notifOpen, setNotifOpen, acctOpen, setAcctOpen,
      confirmSignOut, setConfirmSignOut, requestSignOut, confirmSignOutNow,
      profileEditOnArrive, setProfileEditOnArrive,
      // root hydration-barrier surface
      projectsLoading, loadErrors, retrySurface,
      // session — identity installs go through adopt* (ref + state together)
      profile, adoptProfile, orgAccount, adoptOrgAccount, joinedAt,
      hydrateSession, saveProfileToSupabase, signOut,
      // people
      people, connected, incoming, incomingPending, onConnect, onDisconnect,
      // messaging
      conversations, unreadMessages, blocked,
      thread, threadStatus, threadPeer, threadHasMore, loadingEarlier,
      confirmBlock, setConfirmBlock, confirmDelete, setConfirmDelete,
      openThread, sendThreadMessage, retryThreadMessage, discardFailedMessage,
      loadEarlierThread, requestBlock, blockPeerNow, unblockPeer,
      requestDeleteConversation, deleteConversationNow,
      // projects
      projectsList, saved, joined, requested, rejected,
      projectRequests, pendingRequests, detailFetch, myProjects, detailProject,
      openProject, openEdit, toggleSave,
      updateProjectStatus, setCoLead, kickMember, approveRequest, rejectRequest,
      createProject, saveProjectEdits, deleteProjectById,
      // events + org
      rsvped, toggleRsvp, orgEvents, orgEventsLoading,
      createOrgEvent, updateOrgEvent,
      toast,
    };

    // ---------- DISPATCH ----------
    // Guards, skeleton holds, and bounce corrections stay HERE: they set state
    // during render (sanctioned only for THIS component's own state) and arm
    // the mirror's one-shot replace flag, which the mirror effect consumes
    // unconditionally on every commit -- armed from a child's effect instead,
    // the flag would be eaten on the wrong commit and the correction would
    // pushState a broken history entry. Shells receive only ready-to-render
    // screens. Fall-through order and the compound conditions are load-bearing
    // (a failed condition falls through to the student shell).

    // ---------- ONBOARDING (full-screen, no topbar) ----------
    if (route === "onboarding") return React.createElement(FullScreens, { screen: "onboarding", api });

    // ---------- FORGOT PASSWORD (email → code → new password) ----------
    if (route === "forgot") return React.createElement(FullScreens, { screen: "forgot", api });

    // ---------- ORG SIGN-UP / SIGN-IN (separate auth path) ----------
    if (route === "orgSignup") return React.createElement(FullScreens, { screen: "orgSignup", api });

    // ---------- ORG ONBOARDING (post-signup, pre-dashboard) ----------
    if (route === "orgOnboarding") return React.createElement(FullScreens, { screen: "orgOnboarding", api });

    // ---------- ORG EDIT (owner-only) ----------
    if (route === "orgEditMe") return React.createElement(FullScreens, { screen: "orgEditMe", api });

    // ---------- EVENT CREATE (owner-only) ----------
    if (route === "eventCreate" && orgAccount) return React.createElement(FullScreens, { screen: "eventCreate", api });

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
      return React.createElement(FullScreens, { screen: "eventEdit", draft, api });
    }

    // ---------- CREATE (full-screen, no topbar — same shell as onboarding) ----------
    if (route === "create") return React.createElement(FullScreens, { screen: "create", api });

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
      return React.createElement(FullScreens, { screen: "edit", editProject, api });
    }

    // ---------- ORG APP SHELL (dashboard + own public page) ----------
    if (orgAccount && (route === "orgDashboard" || route === "eventDetail")) {
      return React.createElement(OrgShell, { api });
    }

    // ---------- MAIN APP (student) ----------
    return React.createElement(StudentShell, { api });
  }

  export { App as NestedApp };
  export default App;
