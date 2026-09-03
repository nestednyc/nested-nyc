/* ============================================================
   useSession — identity + session lifecycle: the profile/org
   account state, the localStorage identity cache, session
   hydration + routing (hydrateSession), the auth-change listener,
   profile save, and the auth slice of sign-out.

   Domain-hook pattern: NestedApp stays the composition root and
   injects the URL-mirror machinery this domain steers — applyParsed
   plus the mirror/identity refs (this hook owns every SYNCHRONOUS
   ref write: hydrateSession inline, and adoptProfile/adoptOrgAccount
   for the shells, each pairing the ref with its state so role-gating
   never sees a stale identity on those paths; the remaining bare
   setter writes — the SIGNED_OUT listener, signOutAuth, profile
   save — are never followed by a same-tick applyParsed and lean on
   the root's ref-sync effects), the returnTo stash helpers, and the
   auth-screen setters. Hooks never import each other; anything
   cross-domain arrives as an argument.

   Seams kept in the root:
   - signOut stays a root composer: it awaits signOutAuth() (the
     auth slice owned here) then runs every other domain's reset and
     the router-param clears. Keep signOutAuth limited to auth +
     identity + cache — domain wipes belong to their own hooks.
   - onSignedOut fires after this hook's own SIGNED_OUT handling
     (profile cleared, cache dropped) so the root decides where a
     signed-out tab lands. Cross-tab sign-out deliberately does NOT
     wipe other domains today (pre-existing asymmetry) — widening it
     is a flagged follow-up at this seam.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured, authService, supabase } from '../../lib/supabase'
import { profileService } from '../../services/profileService'
import { orgService } from '../../services/orgService'
import { storageService } from '../../services/storageService'
import { toDbProfile, fromDbProfile, dataUrlToFile } from '../profileAdapter'
import { parse as parseLocation, accessOf } from '../router'
import storageKeys from '../storageKeys.json'

const { useState, useEffect, useRef } = React;

// Key lives in storageKeys.json so the smoke harness (scripts/
// smoke-refactor.cjs seeds this cache) can require the same value —
// a key bump here can't silently desync it.
const LS = storageKeys.identityCache;
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
}
// Which of a student's clubs is the active one in club mode — an id only,
// never the row (rows are re-fetched every hydration). A stale or foreign id
// falls back to the oldest club (pickActive), so nothing can wedge on it.
const ACTIVE_LS = storageKeys.activeOrg;
function loadActiveOrgId() {
  try { return localStorage.getItem(ACTIVE_LS) || null; } catch (e) { return null; }
}
function persistActiveOrgId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_LS, id);
    else localStorage.removeItem(ACTIVE_LS);
  } catch (e) {}
}
// A ?club=<slug> on a dashboard deep link (the transactional emails name the
// club they're about) beats the persisted choice.
function pickActive(list, id, slug) {
  return (slug && list.find((o) => o.slug === slug)) || list.find((o) => o.id === id) || list[0] || null;
}

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

export function useSession({
  applyParsed, authCallbackRef, replaceNextRef, profileRef, orgAccountRef,
  stashReturnTo, takeReturnTo, setAuthMode, setRoute, toast, onSignedOut,
}) {
  const persisted = useRef(loadState());
  if (!persisted.current.joinedAt) persisted.current.joinedAt = Date.now();

  const [profile, setProfile] = useState(persisted.current.profile || null);
  // A signed-in student whose row never completed onboarding (the required
  // photo). Never adopted as identity — FullScreens hands it to the Onboarding
  // screen so the wizard resumes at enrichment instead of showing signup.
  // Cleared whenever a real identity lands or the session ends.
  const [pendingStudent, setPendingStudent] = useState(null);
  // True until the first hydrateSession resolves — lets deep-linked gated
  // screens hold a skeleton instead of crashing on a null profile/org.
  const [sessionPending, setSessionPending] = useState(() => isSupabaseConfigured());
  // Org state. `ownedOrgs` = every organizations row this uid owns (an
  // org-email account owns one; a student who runs clubs owns one or more;
  // most students none). `orgAccount` = the ACTIVE one — the club the
  // dashboard subtree manages. Both are mode-independent: NestedApp derives
  // "club mode" from the route and exposes profile/orgAccount as an either/or
  // pair to the rest of the app, so a student in club mode renders exactly
  // like an org-email account. Populated by hydrateSession via
  // orgService.getMyOrgs; never cached (the LS blob can't identify owners).
  const [orgAccount, setOrgAccount] = useState(null);
  const [ownedOrgs, setOwnedOrgs] = useState([]);

  // persist — a light identity cache only: {profile, joinedAt}. Position
  // (route/ids) now lives in the URL; reopening bare nested.social lands on
  // Discover by design.
  useEffect(() => {
    localStorage.setItem(LS, JSON.stringify({
      profile,
      joinedAt: persisted.current.joinedAt,
    }));
  }, [profile]);

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
      setPendingStudent(null);
      setOwnedOrgs([]);
      setOrgAccount(null);
      orgAccountRef.current = null;
      persistActiveOrgId(null);
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

    // Load BOTH identities: the student profile (profiles.onboarding_completed)
    // and every org this uid owns. A student who runs clubs has both; an
    // org-email account has only orgs (its profile row never completes
    // onboarding — profile_block_org_student_writes); a fresh signup has
    // neither yet. Nothing here picks a mode: NestedApp derives club mode from
    // the route, so this only installs what exists — each ref paired with its
    // state so applyParsed below sees them NOW.
    const [myOrgs, prof] = await Promise.all([orgService.getMyOrgs(), profileService.getCurrentProfile()]);
    if (aborted()) return;
    let owned = (myOrgs && myOrgs.data) || [];
    if (owned.length) {
      // Campus → UNI slug for the dashboard flyer echo (color + logo);
      // resolution lives in orgService.withUniSlugs (one campus fetch).
      owned = await orgService.withUniSlugs(owned);
      if (aborted()) return;
    }
    const row = prof && prof.data;
    const error = prof && prof.error;
    const sessUser = session.user || {};
    let student = !error && row && row.onboarding_completed ? fromDbProfile(row, sessUser.email) : null;
    // A transient profile-read failure must not demote a student into an
    // org-email account (dashboard-only, no way back) or bounce them into the
    // wizard: keep the cached identity for this session and say so.
    if (!student && error && persisted.current.profile) {
      student = persisted.current.profile;
      toast("Couldn't refresh your profile — showing the cached one", "x");
    }

    // ?club=<slug> (dashboard links in the club emails) picks that club; the
    // URL mirror rewrites the bar to the canonical path right after.
    let wantSlug = null;
    try { wantSlug = new URLSearchParams(window.location.search).get("club"); } catch (e) {}
    const active = owned.length ? pickActive(owned, loadActiveOrgId(), wantSlug) : null;
    setOwnedOrgs(owned);
    setOrgAccount(active);
    orgAccountRef.current = active;
    // An errored org read (owned = []) keeps the persisted choice for next time.
    if (!(myOrgs && myOrgs.error)) persistActiveOrgId(active ? active.id : null);
    if (student) {
      setPendingStudent(null);
      setProfile(student);
      profileRef.current = student;
    }

    if (active && !student) {
      // Org-email account: the dashboard subtree is their whole app.
      if (cb) {
        const target = cb.next ? parseLocation(cb.next, "") : null;
        authCallbackRef.current = null;
        applyParsed(target || { route: "orgDashboard", params: {}, state: {} }, { replace: true });
        return finish();
      }
      applyParsed(here, { replace: true });
      return finish();
    }

    if (!student) {
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
        setPendingStudent(null);
        setRoute("orgOnboarding");
      } else {
        // Hand the half-made row (if any) to the wizard so it can resume
        // enrichment — the photo requirement means these rows exist now.
        setPendingStudent(row ? fromDbProfile(row, (session.user && session.user.email) || "") : null);
        setAuthMode("signup");
        setRoute("onboarding");
      }
      return finish();
    }

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
    // applyParsed; anon URLs bounce home there too — which also covers a
    // student who signed in via the org door: applyParsed sees access==="anon"
    // for /org/signup and redirects to discover, so they never land in org
    // onboarding). A /dashboard/* URL passes through when they run clubs —
    // NestedApp renders it in club mode — and bounces home when they don't.
    applyParsed(here, { replace: true });
    return finish();
  }

  // ─── Identity adoption ──────────────────────────────────────
  // The ONE sanctioned way to install a fresh identity outside
  // hydrateSession (which does the same paired write inline): state and
  // the mirror ref move TOGETHER, so an applyParsed/role-gate in the same
  // tick can never read a stale null. Callers (onboarding completion, org
  // creation, org edit-save) must come through here — a bare setProfile/
  // setOrgAccount leaves the ref lagging until the next effect flush.
  function adoptProfile(p) {
    setPendingStudent(null); // the wizard finished — the half-made row is history
    setProfile(p);
    profileRef.current = p;
  }
  // Install (or refresh) an owned org and make it the active one: org
  // onboarding, org edit-save, and a student founding a club all land here.
  // Upserts into ownedOrgs so the switcher's name/logo stay current.
  function adoptOrgAccount(org) {
    setOwnedOrgs((list) => (list.some((o) => o.id === org.id)
      ? list.map((o) => (o.id === org.id ? org : o))
      : [...list, org]));
    setOrgAccount(org);
    orgAccountRef.current = org;
    persistActiveOrgId(org.id);
  }
  // The student ↔ club switch is a navigation, not a stored mode: NestedApp
  // derives club mode from the route (/dashboard/* = club mode). Entering
  // activates the chosen club (paired write, then the route flips the shell
  // in the same render); leaving is just going home.
  function enterClubMode(orgId, target) {
    const org = ownedOrgs.find((o) => o.id === orgId) ||
      (orgAccountRef.current && orgAccountRef.current.id === orgId ? orgAccountRef.current : null);
    if (!org) return;
    adoptOrgAccount(org);
    setRoute(target && accessOf(target) === "org" ? target : "orgDashboard");
    window.scrollTo({ top: 0 });
  }
  function leaveClubMode() {
    setRoute("discover");
    window.scrollTo({ top: 0 });
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
        setPendingStudent(null);
        setOrgAccount(null);
        setOwnedOrgs([]);
        persistActiveOrgId(null);
        try { localStorage.removeItem(LS); } catch (e) {}
        onSignedOut();
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

  // The auth slice of sign-out: end the Supabase session, drop the identity
  // state + cached blob. The ROOT's signOut composes this with every other
  // domain's reset + the router-param clears — domain wipes don't belong here.
  async function signOutAuth() {
    if (isSupabaseConfigured()) {
      await authService.signOut();
    }
    setProfile(null);
    setOrgAccount(null);
    setOwnedOrgs([]);
    setPendingStudent(null);
    persistActiveOrgId(null);
    try { localStorage.removeItem(LS); } catch (e) {}
  }

  return {
    profile, orgAccount, ownedOrgs, sessionPending, pendingStudent,
    joinedAt: persisted.current.joinedAt,
    adoptProfile, adoptOrgAccount, // raw setters stay internal — see above
    enterClubMode, leaveClubMode,
    hydrateSession, saveProfileToSupabase, signOutAuth,
  };
}
