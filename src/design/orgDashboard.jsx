/* ============================================================
   NESTED NYC — Org dashboard (owner control room)
   The page an org account lands on after signing in. A masthead, a
   compact "your public flyer" echo (the owner sees what students see
   without it being a second full page), a Manage panel, a mono
   numbers strip, and the events work-list. The public-facing page
   lives in orgProfile.jsx — this is deliberately a different surface.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { OrgMini, formatEventDate } from './shared'
import { EventRow } from './orgProfile'

  const { useState } = React;

  function OrgDashboard({
    org,
    events = [],
    loading,
    onCreateEvent,
    onEditOrg,
    onEditEvent,
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

        React.createElement("div", { className: "dash-panels fade-up" },
          // Left: the owner's own flyer echo (verified) OR the pending notice.
          org.verified
            ? React.createElement("div", { className: "dash-panel" },
                React.createElement("div", { className: "panel-h" }, "Your public flyer"),
                React.createElement(OrgMini, { name: org.name, type: org.type, uni: org.uni, bio: org.bio, verified: true }),
                React.createElement("p", { className: "echo-note" }, "↳ this is what students see")
              )
            : React.createElement("div", { className: "dash-panel pending" },
                React.createElement("div", { className: "panel-h" }, "Pending review"),
                React.createElement("div", { className: "verify-note", style: { marginTop: 0 } },
                  React.createElement(Icon, { name: "clock", size: 22, stroke: "var(--accent)" }),
                  React.createElement("div", null,
                    React.createElement("b", null, "Your flyer isn't on the board yet"),
                    React.createElement("p", null, "Your page and events stay private until we verify your org — usually within a day. Then it goes live and you can pin events.")
                  )
                )
              ),

          // Right: management + the numbers.
          React.createElement("div", { className: "dash-side" },
            React.createElement("div", { className: "dash-panel" },
              React.createElement("div", { className: "panel-h" }, "Manage"),
              React.createElement("button", { className: "manage-row", onClick: onEditOrg },
                React.createElement(Icon, { name: "edit", size: 17 }), "Edit org details",
                React.createElement("span", { className: "arr" }, React.createElement(Icon, { name: "arrowRight", size: 16 }))),
              canPost && React.createElement("button", { className: "manage-row", onClick: onCreateEvent },
                React.createElement(Icon, { name: "plus", size: 17 }), "Pin an event",
                React.createElement("span", { className: "arr" }, React.createElement(Icon, { name: "arrowRight", size: 16 })))
            ),
            React.createElement("div", { className: "dash-panel" },
              React.createElement("div", { className: "panel-h" }, "The numbers"),
              React.createElement("div", { className: "num-strip" },
                React.createElement("span", null, React.createElement("b", null, upcoming.length), "upcoming"),
                React.createElement("span", null, React.createElement("b", null, past.length), "past"),
                React.createElement("span", null, React.createElement("b", null, totalRsvps), "RSVPs")
              )
            )
          )
        ),

        React.createElement("div", { className: "org-section", style: { marginTop: 18 } },
          React.createElement("div", { className: "sec-h" }, "Events you've posted"),
          React.createElement("div", { className: "dash-tabs" },
            React.createElement("button", { className: "chip-filter" + (tab === 'upcoming' ? " active" : ""), onClick: () => setTab('upcoming') },
              React.createElement(Icon, { name: "calendar", size: 17 }), "Upcoming",
              upcoming.length > 0 && React.createElement("span", { className: "count" }, upcoming.length)),
            React.createElement("button", { className: "chip-filter" + (tab === 'past' ? " active" : ""), onClick: () => setTab('past') },
              React.createElement(Icon, { name: "clock", size: 17 }), "Past",
              past.length > 0 && React.createElement("span", { className: "count" }, past.length))
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
    );
  }

  // Adapt a DB event row to the shape EventRow expects (mon/day strings, etc).
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
