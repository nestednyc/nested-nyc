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
  // True until the first hydrateSession resolves — lets deep-linked gated
  // screens hold a skeleton instead of crashing on a null profile/org.
  const [sessionPending, setSessionPending] = useState(() => isSupabaseConfigured());
  // Org-account state. Populated by session hydration via orgService.getMyOrgs.
  // When orgAccount is non-null the user is signed in AS an organization,
  // not a student, and we render the OrgAppShell subtree instead of the
  // student app.
  const [orgAccount, setOrgAccount] = useState(null);

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
      // Campus → UNI slug for the dashboard flyer echo (color + logo);
      // resolution lives in orgService.withUniSlug.
      ownedOrg = await orgService.withUniSlug(ownedOrg);
      if (aborted()) return;
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

  // ─── Identity adoption ──────────────────────────────────────
  // The ONE sanctioned way to install a fresh identity outside
  // hydrateSession (which does the same paired write inline): state and
  // the mirror ref move TOGETHER, so an applyParsed/role-gate in the same
  // tick can never read a stale null. Callers (onboarding completion, org
  // creation, org edit-save) must come through here — a bare setProfile/
  // setOrgAccount leaves the ref lagging until the next effect flush.
  function adoptProfile(p) {
    setProfile(p);
    profileRef.current = p;
  }
  function adoptOrgAccount(org) {
    setOrgAccount(org);
    orgAccountRef.current = org;
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
    try { localStorage.removeItem(LS); } catch (e) {}
  }

  return {
    profile, orgAccount, sessionPending,
    joinedAt: persisted.current.joinedAt,
    adoptProfile, adoptOrgAccount, // raw setters stay internal — see above
    hydrateSession, saveProfileToSupabase, signOutAuth,
  };
}
