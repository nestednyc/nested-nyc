/* ============================================================
   NESTED NYC — Org dashboard (owner landing)
   The page an org account sees right after they sign in. Shows the
   org card, stats, primary actions (Pin an event · Edit org · View
   public page) and the upcoming/past events tabbed list.
   Data is loaded by NestedApp and passed in; this component is
   purely presentational + dispatches navigation back up.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, Stamp, formatEventDate } from './shared'
import { EventRow, orgSub } from './orgProfile'

  const { useState } = React;

  function StatTile({ label, value }) {
    return (
      React.createElement("div", { className: "stat-tile grain" },
        React.createElement("b", null, value),
        React.createElement("small", null, label)
      )
    );
  }

  function OrgDashboard({
    org,
    events = [],
    loading,
    onCreateEvent,
    onEditOrg,
    onEditEvent,
    onViewPublic,
    onSignOut,
  }) {
    const upcoming = events.filter((e) => !e.is_past);
    const past = events.filter((e) => e.is_past);
    const totalRsvps = events.reduce((acc, e) => acc + (e.attendees || 0), 0);
    const [tab, setTab] = useState('upcoming');
    const list = tab === 'upcoming' ? upcoming : past;
    const canPost = !!(org && org.verified); // unverified orgs can't post until approved

    if (!org) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("h3", null, "No org loaded"),
            React.createElement("p", null, "We couldn't find an org tied to your account. Try signing out and back in."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 18 }, onClick: onSignOut },
              React.createElement(Icon, { name: "arrowRight", size: 16, stroke: "var(--paper)" }), "Sign out")
          )
        )
      );
    }

    return (
      React.createElement("div", { className: "discover" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Your ", React.createElement("em", null, "dashboard")),
            React.createElement("p", { className: "sub" }, "Run your org, post events to the shared NYC calendar, edit your page.")
          ),
          React.createElement("div", { className: "board-actions" },
            canPost && React.createElement("button", { className: "start-btn", onClick: onCreateEvent },
              React.createElement(Icon, { name: "plus", size: 19, stroke: "var(--paper)" }), "Pin an event")
          )
        ),

        React.createElement("section", { className: "org-page grain fade-up", style: { marginTop: 8 } },
          React.createElement("div", { className: "org-banner" },
            React.createElement("span", { className: "tape left" }),
            React.createElement("span", { className: "tape right" }),
            org.verified && React.createElement(Stamp, { size: 88, label: "ORG", className: "org-stamp" })
          ),
          React.createElement("div", { className: "org-inner" },
            React.createElement("div", { className: "org-head" },
              React.createElement("div", { className: "org-logo" }, React.createElement(Av, { name: org.name, size: 84 })),
              React.createElement("div", { className: "org-id" },
                React.createElement("h1", null, org.name),
                React.createElement("div", { className: "org-meta" },
                  orgSub(org),
                  org.verified
                    ? React.createElement("span", { className: "org-badge ok" }, React.createElement(Icon, { name: "check", size: 12, stroke: "var(--paper)", width: 3 }), "Verified")
                    : React.createElement("span", { className: "org-badge pend" }, React.createElement(Icon, { name: "clock", size: 12, stroke: "currentColor" }), "Pending review")
                )
              )
            ),

            !org.verified && React.createElement("div", { className: "verify-note", style: { marginTop: 14 } },
              React.createElement(Icon, { name: "clock", size: 22, stroke: "var(--accent)" }),
              React.createElement("div", null,
                React.createElement("b", null, "Pending review — your page isn't public yet"),
                React.createElement("p", null, "Your org page and events stay private until we verify you, usually within a day. Once approved, your page goes live and you can start posting events.")
              )
            ),

            React.createElement("div", { className: "stat-row", style: { marginTop: 18 } },
              React.createElement(StatTile, { label: "Upcoming", value: upcoming.length }),
              React.createElement(StatTile, { label: "Past events", value: past.length }),
              React.createElement(StatTile, { label: "Total RSVPs", value: totalRsvps })
            ),

            React.createElement("div", { className: "org-cta", style: { marginTop: 18 } },
              canPost && React.createElement("button", { className: "btn btn-primary", onClick: onCreateEvent },
                React.createElement(Icon, { name: "plus", size: 17, stroke: "var(--paper)" }), "Pin an event"),
              React.createElement("button", { className: "btn btn-ghost", onClick: onEditOrg },
                React.createElement(Icon, { name: "edit", size: 16 }), "Edit org"),
              React.createElement("button", { className: "btn btn-ghost", onClick: onViewPublic },
                React.createElement(Icon, { name: "external", size: 16 }), "View public page")
            ),

            React.createElement("div", { className: "org-section" },
              React.createElement("div", { className: "sec-h" }, "Events you've posted"),
              React.createElement("div", { className: "match-tabs" },
                React.createElement("button", { className: "match-tab" + (tab === 'upcoming' ? " active" : ""), onClick: () => setTab('upcoming') },
                  React.createElement(Icon, { name: "calendar", size: 18 }), "Upcoming",
                  upcoming.length > 0 && React.createElement("span", { className: "b" }, upcoming.length)),
                React.createElement("button", { className: "match-tab" + (tab === 'past' ? " active" : ""), onClick: () => setTab('past') },
                  React.createElement(Icon, { name: "clock", size: 18 }), "Past",
                  past.length > 0 && React.createElement("span", { className: "b" }, past.length))
              ),

              loading
                ? React.createElement("div", { className: "org-empty" },
                    React.createElement("p", null, "Loading…"))
                : list.length
                  ? React.createElement("div", { className: "event-list" },
                      list.map((e) => React.createElement(EventRow, {
                        key: e.id,
                        e: toRowShape(e),
                        onOpen: () => onEditEvent && onEditEvent(e.id),
                        trailing: () => React.createElement("small", { className: "er-going" }, (e.attendees || 0) + " RSVPs"),
                      })))
                  : React.createElement("div", { className: "org-empty" },
                      React.createElement(Icon, { name: "calendar", size: 34, stroke: "var(--accent)" }),
                      React.createElement("p", null, tab === 'upcoming' ? "No upcoming events yet — pin your first one." : "No past events."),
                      tab === 'upcoming' && canPost && React.createElement("button", { className: "btn btn-primary", style: { marginTop: 14 }, onClick: onCreateEvent },
                        React.createElement(Icon, { name: "plus", size: 16, stroke: "var(--paper)" }), "Pin an event"))
            )
          )
        )
      )
    );
  }

  // Adapt a DB event row to the shape EventRow expects (mon/day strings, etc).
  // Kept local to the dashboard — the student-side Events feed gets its own
  // adapter in Phase E (see plan).
  function toRowShape(dbEvent) {
    const { mon, day } = formatEventDate(dbEvent.date);
    return {
      id: dbEvent.id,
      type: dbEvent.event_type || 'talk',
      title: dbEvent.title,
      mon, day,
      time: dbEvent.time || '',
      place: dbEvent.location || '',
      going: dbEvent.attendees || 0,
      goingNames: [],
      isPast: !!dbEvent.is_past,
    };
  }

  export { OrgDashboard };
  export default OrgDashboard;
