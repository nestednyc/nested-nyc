/* ============================================================
   NESTED NYC — Org view (public, slug-based loader)
   Used when a student clicks an event host pill or an org's name on
   the community board: load the org by slug from Supabase and render
   the public OrgProfile around it — events, the org's board posts,
   follower count, and the real Follow button (state lives in
   useCommunity; this wrapper just fetches and adapts).
   ============================================================ */
import React from 'react'
import OrgProfile from './orgProfile'
import { orgService } from '../services/orgService'
import { communityService } from '../services/communityService'
import { fromDbPost } from './postAdapter'
import { formatEventDate, ConfirmModal } from './shared'
import { clubService } from '../services/clubService'
import { profileService } from '../services/profileService'
import { bareHandle, fullNameOf } from './data'
import { SHOW_EVENTS } from '../config/features'

  const { useState, useEffect, useRef } = React;

  function adaptEventForRow(e) {
    const { mon, day } = formatEventDate(e.date);
    return {
      id: e.id,
      type: e.event_type || 'talk',
      title: e.title,
      mon, day,
      time: e.time || '',
      place: e.location || '',
      going: e.attendees || 0,
      goingNames: [],
      isPast: !!e.is_past,
    };
  }

  // `onManage`: passed for the founder's own student-run club — the page
  // swaps Join / Follow for a single "Manage club" CTA.
  function OrgView({ slug, profile, follows, followsLoaded, canFollow = true, onToggleFollow, onBack, onOpenEvent, onToast,
                     memberships, canJoin = false, onJoin, onLeave, onOpenPerson, onManage }) {
    const [org, setOrg] = useState(null);
    // Who founded a student-run club ({ handle, name, uni }); null otherwise.
    const [founder, setFounder] = useState(null);
    const [events, setEvents] = useState([]);
    const [posts, setPosts] = useState([]);
    const [followerCount, setFollowerCount] = useState(null);
    const [members, setMembers] = useState([]);
    const [memberCount, setMemberCount] = useState(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    // Whether I followed this org when the count was fetched, so the
    // optimistic toggle can nudge the number without a refetch. For a student
    // that needs `follows` hydrated first — NestedApp's route effect starts
    // ensureFollows; this effect re-runs when it lands.
    const baseFollowingRef = useRef(false);
    const followsReady = !profile || !!followsLoaded;

    useEffect(() => {
      if (!followsReady) return;
      let cancelled = false;
      setLoading(true);
      setMissing(false);

      (async () => {
        const { data: orgRow, error: orgErr } = await orgService.getBySlug(slug);
        if (cancelled) return;
        if (orgErr || !orgRow) {
          setMissing(true);
          setLoading(false);
          return;
        }
        // Campus → UNI slug so the poster can show the campus color + logo;
        // resolution lives in orgService.withUniSlug.
        const enriched = await orgService.withUniSlug(orgRow);
        if (cancelled) return;
        setOrg(enriched);
        const joinable = orgRow.type !== "university";
        // A student-founded club names its founder ("Founded by @handle") —
        // public_profiles is anon-readable, so guests get the line too.
        const founderId = orgRow.student_run && orgRow.owner_user_id ? orgRow.owner_user_id : null;
        const [{ data: evs }, { data: n }, { data: rows }, { data: roster }, { data: mc }, { data: founderRow }] = await Promise.all([
          orgService.getOrgEvents(orgRow.id),
          communityService.getOrgFollowerCount(orgRow.id),
          // Board posts are signed-in-only (RLS) — guests just don't get the section.
          profile ? communityService.getOrgPosts(orgRow.id, { limit: 6 }) : Promise.resolve({ data: [] }),
          joinable ? clubService.getOrgMembers(orgRow.id) : Promise.resolve({ data: [] }),
          joinable ? clubService.getOrgMemberCount(orgRow.id) : Promise.resolve({ data: null }),
          founderId ? profileService.getPublicProfile(founderId) : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        setEvents((evs || []).map(adaptEventForRow));
        setFounder(founderRow && founderRow.username
          ? { handle: bareHandle(founderRow.username), name: fullNameOf(founderRow.first_name, founderRow.last_name), uni: founderRow.university || null }
          : null);
        setFollowerCount(typeof n === "number" ? n : 0);
        setMembers(roster || []);
        setMemberCount(joinable ? (typeof mc === "number" ? mc : 0) : null);
        baseFollowingRef.current = !!(follows && follows.has(orgRow.id));
        setPosts((rows || []).map(fromDbPost).filter(Boolean));
        setLoading(false);
      })();

      return () => { cancelled = true; };
    }, [slug, followsReady]);

    if (loading) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "disco-head" },
            React.createElement("div", { className: "head-txt" },
              React.createElement("h1", null, "Loading…")
            )
          )
        )
      );
    }

    if (missing || !org) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("h3", null, "Org not found"),
            React.createElement("p", null, "We couldn't find that organization on Nested."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 18 }, onClick: onBack },
              SHOW_EVENTS ? "Back to events" : "Back to the board")
          )
        )
      );
    }

    const following = !!(follows && follows.has(org.id));
    const shownCount = followerCount === null ? null
      : Math.max(0, followerCount + (following ? 1 : 0) - (baseFollowingRef.current ? 1 : 0));
    const membership = memberships ? memberships[org.id] : undefined;
    // Accepted / pending: the button becomes "leave / withdraw" behind a confirm.
    const onJoinClick = () => {
      if (!onJoin) { onToast && onToast('Sign in to join ' + org.name, 'sparkle'); return; }
      if (membership && (membership.status === "accepted" || membership.status === "pending")) { setConfirmLeave(true); return; }
      onJoin(org);
    };
    const leaving = membership && membership.status === "accepted";

    return React.createElement(React.Fragment, null,
      React.createElement(OrgProfile, {
        org,
        events,
        posts,
        following,
        followerCount: shownCount,
        canFollow,
        onBack,
        onOpenEvent,
        onFollow: () => {
          if (onToggleFollow) return onToggleFollow(org.id);
          onToast && onToast('Sign in to follow ' + org.name, 'sparkle');
        },
        membership,
        canJoin,
        onJoin: onJoinClick,
        members,
        memberCount,
        onOpenPerson,
        founder,
        onManage,
      }),
      confirmLeave && React.createElement(ConfirmModal, {
        accent: "var(--c-startup)",
        title: leaving ? "Leave " + org.name + "?" : "Withdraw your application?",
        body: leaving ? "You'll drop off the roster. You can apply again any time." : "The club won't see it anymore. You can apply again later.",
        ctaLabel: leaving ? "Leave" : "Withdraw",
        ctaIcon: "x",
        danger: true,
        onCancel: () => setConfirmLeave(false),
        onConfirm: () => {
          setConfirmLeave(false);
          if (leaving) setMemberCount((n) => (n === null ? n : Math.max(0, n - 1)));
          if (leaving && profile) setMembers((m) => m.filter((r) => r.userId !== profile.id));
          onLeave && onLeave(org.id);
        },
      })
    );
  }

  export { OrgView };
  export default OrgView;
