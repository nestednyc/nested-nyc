/* ============================================================
   OrgShell — the org owner's app frame: minimal topbar (brand +
   dashboard + community + sign-out chip), the dashboard, the org's
   view of the community board (posting AS the org), and the
   org-side event detail. Render-only; NestedApp's dispatch owns the
   `orgAccount && (orgDashboard || orgCommunity || eventDetail)`
   condition (the eventDetail route is dual-homed org/student).
   ============================================================ */
import React from 'react'
import Icon from '../icons'
import { Av, Toasts } from '../shared'
import { StyleTweaks } from '../tweaks-panel'
import OrgDashboard from '../orgDashboard'
import EventDetail from '../eventDetail'
import Community from '../community'
import EventResponses from '../eventResponses'
import OrgMembers from '../orgMembers'

export default function OrgShell({ api }) {
  const {
    t, setTweak, toasts, rootClass, rootStyle,
    route, setRoute, orgAccount, signOut,
    orgEvents, orgEventsLoading, setEventDraftId, eventDraftId,
    eventResponses, loadEventResponses,
    eventViewId, setEventViewId,
    profile, rsvped, toggleRsvp, openOrgView, openProfile, connected,
    projectsList, openProject, openEventDetail, eventViewFrom,
    // community board (org side)
    feed, feedLoading, feedError, refreshFeed,
    feedHasMore, loadingMore, loadMoreFeed,
    boardEvents, spotlight, reported, reportContent, editCommunityPost,
    activity, unreadActivity, markActivityRead, toast,
    follows, orgFollowerCount, orgPostCount,
    postLikes, postSaves, postComments, posting,
    createCommunityPost, deleteCommunityPost, togglePostLike, togglePostSave, toggleFollowOrg,
    loadPostComments, addCommunityComment, deleteCommunityComment,
    applicants, loadApplicants, decideApplicant, pendingCount, orgMemberCount,
  } = api;

      const canPost = !!(orgAccount && orgAccount.verified);

      return (
        React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
          // Minimal topbar: brand + org chip + sign-out. No student NAV/search.
          React.createElement("header", { className: "topbar" },
            React.createElement("div", { className: "brand", onClick: () => setRoute("orgDashboard") },
              React.createElement("span", { className: "mark" }, "N", React.createElement("span", null, ".")),
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            ),
            React.createElement("nav", { className: "nav" },
              React.createElement("button", {
                className: route === "orgDashboard" ? "active" : "",
                onClick: () => setRoute("orgDashboard"),
              }, React.createElement(Icon, { name: "grid", size: 18 }), "Dashboard"),
              canPost && React.createElement("button", {
                className: route === "orgCommunity" ? "active" : "",
                onClick: () => { setRoute("orgCommunity"); window.scrollTo({ top: 0 }); },
              }, React.createElement(Icon, { name: "board", size: 18 }), "Community")
            ),
            React.createElement("span", { className: "spacer", style: { flex: 1 } }),
            React.createElement("button", { className: "me-chip", onClick: signOut, title: "Sign out" },
              React.createElement(Av, { name: orgAccount.name, img: orgAccount.logo || null }),
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
            followerCount: orgFollowerCount,
            postCount: orgPostCount,
            activity, unreadActivity,
            onSeenActivity: markActivityRead,
            onOpenActivity: (n) => { setRoute(n && n.kind === "org_join_request" ? "orgMembers" : "orgCommunity"); window.scrollTo({ top: 0 }); },
            pendingCount, memberCount: orgMemberCount,
            onOpenMembers: () => { setRoute("orgMembers"); window.scrollTo({ top: 0 }); },
            onCreateEvent: () => { setRoute("eventCreate"); window.scrollTo({ top: 0 }); },
            onEditOrg: () => { setRoute("orgEditMe"); window.scrollTo({ top: 0 }); },
            onEditEvent: (id) => { setEventDraftId(id); setRoute("eventEdit"); window.scrollTo({ top: 0 }); },
            onOpenResponses: (id) => { setEventDraftId(id); setRoute("eventResponses"); window.scrollTo({ top: 0 }); },
            onOpenCommunity: () => { setRoute("orgCommunity"); window.scrollTo({ top: 0 }); },
            onSignOut: signOut,
          }),

          // The org's seat at the community board: same feed students see,
          // composer posts AS the org (verified orgs only — the dispatch in
          // NestedApp bounces unverified ones back to the dashboard).
          route === "orgCommunity" && React.createElement(Community, {
            asOrg: orgAccount,
            projects: projectsList || [],
            feed, feedLoading, feedError, onRetry: refreshFeed,
            feedHasMore, loadingMore, onLoadMore: loadMoreFeed,
            boardEvents, spotlight,
            reported, onReport: reportContent,
            rsvped,
            onOpenEvent: (id) => openEventDetail(id, "community"),
            onCreateEvent: () => { setRoute("eventCreate"); window.scrollTo({ top: 0 }); },
            follows, orgFollowerCount,
            postLikes, postSaves, postComments, posting,
            onCreatePost: createCommunityPost,
            onDeletePost: deleteCommunityPost,
            onEditPost: editCommunityPost,
            toast,
            onToggleLike: togglePostLike,
            onToggleSave: togglePostSave,
            onToggleFollow: toggleFollowOrg,
            onLoadComments: loadPostComments,
            onAddComment: addCommunityComment,
            onDeleteComment: deleteCommunityComment,
            // No project navigation from the org seat: /projects/:id renders in
            // the student shell, which an org account can't use (see OrgShell
            // dispatch) — the board shows project tags as plain labels instead.
            onOpenProject: null,
            onOpenOrg: openOrgView,
            onStart: () => {},
          }),

          // Who's going to one of my events + what they answered (+ CSV).
          route === "eventResponses" && React.createElement(EventResponses, {
            event: (orgEvents || []).find((e) => e.id === eventDraftId) || null,
            state: eventResponses && eventResponses.id === eventDraftId ? eventResponses : null,
            onBack: () => { setEventDraftId(null); setRoute("orgDashboard"); window.scrollTo({ top: 0 }); },
            onRetry: () => loadEventResponses(eventDraftId),
            onEditEvent: (id) => { setEventDraftId(id); setRoute("eventEdit"); window.scrollTo({ top: 0 }); },
          }),

          // Who applied to join the club, their answers, accept / decline.
          route === "orgMembers" && React.createElement(OrgMembers, {
            org: orgAccount,
            state: applicants,
            onBack: () => { setRoute("orgDashboard"); window.scrollTo({ top: 0 }); },
            onRetry: loadApplicants,
            onDecide: decideApplicant,
            onEditOrg: () => { setRoute("orgEditMe"); window.scrollTo({ top: 0 }); },
          }),

          // Org owner viewing the public side of one of their own events.
          // EventDetail detects isOwner via orgAccount.id === event.organization_id
          // and swaps the RSVP CTA for "Edit event" → eventEdit.
          route === "eventDetail" && eventViewId && React.createElement(EventDetail, {
            eventId: eventViewId,
            profile,
            rsvped,
            orgAccount,
            onBack: () => { setEventViewId(null); setRoute(eventViewFrom === "community" ? "orgCommunity" : "orgDashboard"); },
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
