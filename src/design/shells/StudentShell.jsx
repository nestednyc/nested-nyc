/* ============================================================
   StudentShell — the signed-in / guest student frame: topbar
   (desktop + mobile clusters), every student route render, the
   mobile account sheet, the join/contact Modal, SoonPane, and
   the three confirm modals. Render-only: state and handlers all
   arrive via the `api` bag from NestedApp (the composition
   root); the destructure below keeps the moved JSX byte-
   identical. The detail-route skeleton/empty guards live here
   (they don't set state — only the bounce guards had to stay
   in the root).
   ============================================================ */
import React from 'react'
import Icon from '../icons'
import { NestedData, CAT } from '../data'
import { Av, Toasts, Stamp, Skeleton, ConfirmModal, NAV } from '../shared'
import { StyleTweaks } from '../tweaks-panel'
import Discover, { ProjectCard } from '../discover'
import Events from '../events'
import Matches from '../matches'
import People, { ContactLinks } from '../people'
import Community, { CommunityPost, SavedPosts } from '../community'
import { RsvpModal } from '../eventRsvp'
import { ApplyModal } from '../clubJoin'
import UserProfile from '../userProfile'
import Notifications from '../notifications'
import Messages from '../messages'
import MessageThread from '../messageThread'
import { NotifPanel, AccountPanel } from '../headerMenus'
import ProjectDetail from '../detail'
import Profile from '../profile'
import OrgView from '../orgView'
import EventDetail from '../eventDetail'

const { useState } = React;

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


export default function StudentShell({ api }) {
  const {
    t, setTweak, toasts, rootClass, rootStyle,
    route, setRoute, goNav, goAuth, requireAuth,
    query, setQuery, soonLabel, modal, setModal, submitModal,
    justVerified, sheetOpen, setSheetOpen, mSearchOpen, setMSearchOpen,
    notifOpen, setNotifOpen, acctOpen, setAcctOpen,
    confirmSignOut, setConfirmSignOut, requestSignOut, confirmSignOutNow,
    profileEditOnArrive, setProfileEditOnArrive,
    projectsLoading, loadErrors, retrySurface,
    profile, joinedAt, saveProfileToSupabase, signOut,
    people, connected, incoming, incomingPending, onConnect, onDisconnect,
    conversations, unreadMessages, blocked,
    thread, threadStatus, threadPeer, threadHasMore, loadingEarlier,
    confirmBlock, setConfirmBlock, confirmDelete, setConfirmDelete,
    openThread, sendThreadMessage, retryThreadMessage, discardFailedMessage,
    loadEarlierThread, requestBlock, blockPeerNow, unblockPeer,
    requestDeleteConversation, deleteConversationNow,
    projectsList, saved, joined, requested, rejected,
    projectRequests, pendingRequests, detailFetch, myProjects, detailProject,
    openProject, openEdit, toggleSave,
    updateProjectStatus, setCoLead, kickMember, approveRequest, rejectRequest,
    rsvped, toggleRsvp, orgEvents, orgAccount,
    rsvpPrompt, rsvpSubmitting, rsvpError, requestRsvp, editRsvpAnswers, submitRsvp, cancelRsvpPrompt,
    myAnswers, loadMyAnswers,
    eventViewId, setEventViewId, eventViewFrom,
    orgViewSlug, setOrgViewSlug, profileViewUsername, messageThreadHandle,
    setEventDraftId, openEventDetail, openOrgView, openPerson, openProfile,
    feed, feedLoading, feedError, refreshFeed, savedPosts, savedLoading,
    postLikes, postSaves, postComments, posting,
    createCommunityPost, deleteCommunityPost, togglePostLike, togglePostSave,
    loadPostComments, addCommunityComment, deleteCommunityComment,
    follows, followsLoaded, followedOrgs, toggleFollowOrg,
    feedHasMore, loadingMore, loadMoreFeed,
    boardEvents, spotlight, reported, reportContent,
    postViewId, openPost, postDetail, editCommunityPost,
    composerPreset, openBoardComposer, clearComposerPreset, projectPosts,
    activity, activityLoading, unreadActivity, markActivityRead,
    memberships, myClubs, applyPrompt, applySubmitting, applyError, requestJoinClub, submitApplication, cancelApply, leaveOrg,
    toast,
  } = api;

  // The bell counts the two actionable kinds + unread activity (likes,
  // comments, mentions) — one number for the dot, the panel and the sheet.
  const notifCount = incomingPending.length + projectRequests.length + (unreadActivity || 0);
  // Where an activity row leads: the note it's about, else the person.
  function openActivity(n) {
    if (n.postId) return openPost(n.postId);
    if (n.actor && n.actor.handle) return openPerson(n.actor.handle);
  }

  // "Request to join" — one entry point shared by the flyer page and the
  // board's "I'm interested" CTA: guest → auth wall; already on / already
  // asked → a toast; otherwise the join modal (note + role pick).
  function requestJoin(p) {
    if (!profile) { requireAuth("Sign in to request to join"); return; }
    if (joined.has(p.id)) { toast("You're already on this team", "check"); }
    else if (requested.has(p.id)) { toast("You've already requested to join", "check"); }
    else { setModal({ type: "join", project: p }); }
  }

    return (
      React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
        // top bar
        React.createElement("header", { className: "topbar" },
          React.createElement("div", { className: "brand", onClick: () => goNav("discover") },
            React.createElement("span", { className: "mark" }, "N", React.createElement("span", null, ".")),
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
                notifCount > 0 && React.createElement("span", { className: "dot" })
              ),
              React.createElement(NotifPanel, {
                open: notifOpen,
                count: notifCount,
                incoming: incomingPending,
                projectRequests,
                activity,
                unreadCount: unreadActivity || 0,
                onOpenActivity: openActivity,
                onSeen: markActivityRead,
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
                React.createElement(Av, { name: profile.username, img: firstPhotoUrl(profile.photos) }),
                React.createElement("span", { className: "who" },
                  React.createElement("b", null, "@" + profile.username),
                  React.createElement("small", null, (NestedData.UNI[profile.uni] || {}).name)
                )
              ),
              React.createElement(AccountPanel, {
                open: acctOpen,
                profile,
                photoUrl: firstPhotoUrl(profile.photos),
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
            !profile && React.createElement("button", { className: "btn btn-primary", onClick: () => goAuth("signup"), title: "Create your account" }, "Sign up")
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
              React.createElement(Av, { name: profile.username, img: firstPhotoUrl(profile.photos) }),
              notifCount > 0 && React.createElement("span", { className: "dot" })
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
          profile,
          follows,
          followsLoaded,
          // Org accounts browse other orgs' pages too — following is a student thing.
          canFollow: !orgAccount,
          onToggleFollow: toggleFollowOrg,
          onBack: () => { setOrgViewSlug(null); goNav("events"); },
          onOpenEvent: (id) => openEventDetail(id, "orgView"),
          onToast: toast,
          // Join: students only (org accounts browse, they don't apply).
          memberships,
          canJoin: !orgAccount,
          onJoin: profile && !orgAccount ? requestJoinClub : null,
          onLeave: leaveOrg,
          onOpenPerson: openPerson,
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
            else if (eventViewFrom === "community") setRoute("community");
            else goNav("events");
          },
          onRSVP: toggleRsvp,
          onRequestRsvp: requestRsvp,
          onEditAnswers: editRsvpAnswers,
          myAnswers,
          onLoadMyAnswers: loadMyAnswers,
          onOpenOrg: openOrgView,
          onEditEvent: (id) => { setEventDraftId(id); setEventViewId(null); setRoute("eventEdit"); window.scrollTo({ top: 0 }); },
          onSignIn: () => { setEventViewId(null); setRoute("onboarding"); },
          onOpenProfile: openProfile,
          onConnect,
          connected,
        }),

        route === "community" && React.createElement(Community, {
          profile,
          projects: projectsList,
          people,
          feed, feedLoading, feedError, onRetry: refreshFeed,
          feedHasMore, loadingMore, onLoadMore: loadMoreFeed,
          boardEvents, spotlight,
          reported, onReport: reportContent,
          joined, requested,
          rsvped, onRsvp: requestRsvp,
          onOpenEvent: (id) => openEventDetail(id, "community"),
          onRequestJoin: requestJoin,
          onMessage: (person) => openThread(person),
          onOpenPost: openPost,
          onEditPost: editCommunityPost,
          toast,
          postLikes, postSaves, postComments, posting,
          onCreatePost: createCommunityPost,
          onDeletePost: deleteCommunityPost,
          onToggleLike: togglePostLike,
          onToggleSave: togglePostSave,
          onLoadComments: loadPostComments,
          onAddComment: addCommunityComment,
          onDeleteComment: deleteCommunityComment,
          follows, memberships, onJoin: requestJoinClub,
          onToggleFollow: toggleFollowOrg,
          onOpenOrg: openOrgView,
          connected, onConnect, onDisconnect,
          onOpenPerson: openPerson,
          onOpenProject: openProject,
          onStart: () => { setRoute("create"); window.scrollTo({ top: 0 }); },
          composerPreset, onPresetConsumed: clearComposerPreset,
          followedOrgs, onPostAbout: openBoardComposer,
        }),

        route === "communityPost" && React.createElement(CommunityPost, {
          profile,
          projects: projectsList,
          postId: postViewId,
          detail: postDetail,
          postLikes, postSaves, postComments, follows, joined, requested, reported, memberships, onJoin: requestJoinClub,
          onBack: () => { setRoute("community"); window.scrollTo({ top: 0 }); },
          onToggleLike: togglePostLike,
          onToggleSave: togglePostSave,
          onToggleFollow: toggleFollowOrg,
          onLoadComments: loadPostComments,
          onAddComment: addCommunityComment,
          onDeleteComment: deleteCommunityComment,
          onDeletePost: (id) => { deleteCommunityPost(id); setRoute("community"); window.scrollTo({ top: 0 }); },
          onEditPost: editCommunityPost,
          onReport: reportContent,
          onRequestJoin: requestJoin,
          onMessage: (person) => openThread(person),
          onOpenProject: openProject,
          onOpenOrg: openOrgView,
          onOpenPerson: openPerson,
          onOpenPost: openPost,
          toast,
        }),

        route === "people" && React.createElement(People, {
          people,
          connected,
          onConnect,
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
          onOpenOrg: openOrgView,
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
          activity, activityLoading, unreadActivity,
          onMarkAllRead: markActivityRead,
          onOpenActivity: openActivity,
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
          // Saved community posts ride along under the saved projects — the
          // board's own cards, fed from useCommunity's cached saved list.
          savedPostCount: (savedPosts || []).length,
          savedPosts: profile ? React.createElement(SavedPosts, {
            profile,
            projects: projectsList,
            posts: savedPosts, loading: savedLoading,
            postLikes, postSaves, postComments, follows, joined, requested, reported, memberships, onJoin: requestJoinClub,
            onToggleLike: togglePostLike,
            onToggleSave: togglePostSave,
            onToggleFollow: toggleFollowOrg,
            onLoadComments: loadPostComments,
            onAddComment: addCommunityComment,
            onDeleteComment: deleteCommunityComment,
            onDeletePost: deleteCommunityPost,
            onEditPost: editCommunityPost,
            onReport: reportContent,
            onRequestJoin: requestJoin,
            onMessage: (person) => openThread(person),
            onOpenProject: openProject,
            onOpenOrg: openOrgView,
            onOpenPerson: openPerson,
            onOpenPost: openPost,
            toast,
          }) : null,
        }),

        // Deep-linked detail: skeleton while the feed / by-id fetch resolves;
        // gone (or never visible) → a cork-board flavored empty state.
        route === "detail" && !detailProject && (projectsLoading || detailFetch === "loading") &&
          React.createElement("div", { className: "discover" }, React.createElement(Skeleton, { count: 3 })),
        route === "detail" && !detailProject && !projectsLoading && detailFetch !== "loading" &&
          React.createElement("div", { className: "discover" },
            React.createElement("div", { className: "match-empty fade-up" },
              React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "search", size: 42, stroke: "var(--accent)" })),
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
          onRequest: requestJoin,
          onEdit: (p) => openEdit(p.id),
          onUpdateStatus: updateProjectStatus,
          onSetCoLead: setCoLead,
          onKickMember: kickMember,
          onOpenProfile: openProfile,
          // The board, from the flyer: post about this project / read what's been said.
          projectPosts: (projectPosts && projectPosts[detailProject.id]) || null,
          onPostUpdate: (id) => { openBoardComposer(id); setRoute("community"); window.scrollTo({ top: 0 }); },
          onOpenPost: openPost,
        }),

        route === "profile" && React.createElement(Profile, {
          profile,
          clubs: myClubs, onOpenOrg: openOrgView,
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
        // The event's question sheet — opens from "I'm going" on the event page or a board card.
        rsvpPrompt && React.createElement(RsvpModal, {
          key: rsvpPrompt.event.id + (rsvpPrompt.editing ? ":edit" : ""),
          event: rsvpPrompt.event, initial: rsvpPrompt.initial, editing: rsvpPrompt.editing,
          submitting: rsvpSubmitting, error: rsvpError,
          onCancel: cancelRsvpPrompt, onSubmit: submitRsvp,
        }),
        // A club's application sheet — opens from Join on the club page or a board card.
        applyPrompt && React.createElement(ApplyModal, {
          key: applyPrompt.org.id,
          org: applyPrompt.org,
          submitting: applySubmitting, error: applyError,
          onCancel: cancelApply, onSubmit: (answers) => submitApplication(answers),
        }),
        // Mobile account sheet (≤860px) — opened by the top-bar avatar; nests
        // Profile / Saved / Notifications / Sign out so the mobile bar stays minimal.
        sheetOpen && profile && React.createElement("div", { className: "sheet-scrim", onClick: () => setSheetOpen(false) },
          React.createElement("div", { className: "acct-sheet", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "acct-head" },
              React.createElement(Av, { name: profile.username, img: firstPhotoUrl(profile.photos) }),
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
              notifCount > 0 && React.createElement("span", { className: "acct-badge" }, notifCount)),
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

