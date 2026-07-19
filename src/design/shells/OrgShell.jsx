/* ============================================================
   OrgShell — the org owner's app frame: minimal topbar (brand +
   dashboard + sign-out chip), the dashboard, and the org-side
   event detail. Render-only; NestedApp's dispatch owns the
   `orgAccount && (orgDashboard || eventDetail)` condition (the
   eventDetail route is dual-homed org/student).
   ============================================================ */
import React from 'react'
import Icon from '../icons'
import { Av, Toasts } from '../shared'
import { StyleTweaks } from '../tweaks-panel'
import OrgDashboard from '../orgDashboard'
import EventDetail from '../eventDetail'

export default function OrgShell({ api }) {
  const {
    t, setTweak, toasts, rootClass, rootStyle,
    route, setRoute, orgAccount, signOut,
    orgEvents, orgEventsLoading, setEventDraftId,
    eventViewId, setEventViewId,
    profile, rsvped, toggleRsvp, openOrgView, openProfile, connected,
  } = api;

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
