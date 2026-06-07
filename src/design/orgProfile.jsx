/* ============================================================
   NESTED NYC — Org profile (public page)
   Banner + logo + .edu verified stamp, bio, links, and the
   org's events split into Upcoming / Past. Owners get
   "Manage" + "Pin an event"; visitors get Follow + links.
   Exports OrgCard + EventRow for reuse (dashboard, event detail).
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ETYPE, UNI, ORG_TYPES } from './data'
import { Av, Facepile, CatTag, Stamp } from './shared'

  const { useState } = React;

  // Force user-supplied org links into an http(s) context so a javascript:/data:
  // URL can't execute when clicked. Mirrors the LinkPill guard in people.jsx.
  const safeUrl = (u) => {
    const s = (u || "").trim();
    return s ? (/^https?:\/\//i.test(s) ? s : "https://" + s) : null;
  };

  function orgSub(org) {
    const typeLabel = (ORG_TYPES.find((t) => t.id === org.type) || {}).label || "Organization";
    const uniName = org.uni && UNI[org.uni] ? UNI[org.uni].name : null;
    return [typeLabel, uniName].filter(Boolean).join(" · ");
  }

  // Compact org card — used for "Hosted by" links and lists.
  function OrgCard({ org, onOpen, kicker }) {
    return (
      React.createElement("button", { className: "org-card", onClick: () => onOpen && onOpen(org.id), type: "button" },
        React.createElement(Av, { name: org.name, size: 44 }),
        React.createElement("span", { className: "oc-id" },
          kicker && React.createElement("span", { className: "oc-kicker" }, kicker),
          React.createElement("b", null, org.name,
            org.verified && React.createElement("span", { className: "verify-tick", title: "Verified .edu org" },
              React.createElement(Icon, { name: "check", size: 11, stroke: "var(--paper)", width: 3 }))),
          React.createElement("small", null, orgSub(org))
        ),
        onOpen && React.createElement(Icon, { name: "arrowRight", size: 18, stroke: "var(--ink-faint)" })
      )
    );
  }

  // Compact event list row — used on org profile + dashboard.
  function EventRow({ e, onOpen, trailing }) {
    const ty = ETYPE[e.type] || ETYPE.talk;
    const extra = Math.max(0, e.going - Math.min(3, (e.goingNames || []).length));
    return (
      React.createElement("button", { className: "event-row" + (e.isPast ? " past" : ""), onClick: () => onOpen && onOpen(e.id), type: "button" },
        React.createElement("span", { className: "er-stripe", style: { background: ty.color } }),
        React.createElement("span", { className: "er-date" },
          React.createElement("b", null, e.day),
          React.createElement("small", null, e.mon)
        ),
        React.createElement("span", { className: "er-main" },
          React.createElement("span", { className: "er-top" },
            React.createElement(CatTag, { cat: ty }),
            e.isPast && React.createElement("span", { className: "er-ended" }, "Ended")
          ),
          React.createElement("b", { className: "er-title" }, e.title),
          React.createElement("span", { className: "er-meta" },
            React.createElement(Icon, { name: "clock", size: 13 }), e.time,
            React.createElement("span", { className: "er-dot" }, "·"),
            React.createElement(Icon, { name: "map", size: 13 }), e.place
          )
        ),
        trailing
          ? React.createElement("span", { className: "er-right" }, trailing(e))
          : React.createElement("span", { className: "er-right" },
              React.createElement(Facepile, { names: (e.goingNames || []).slice(0, 3), extra }),
              React.createElement("small", { className: "er-going" }, e.going + " going")
            )
      )
    );
  }

  function OrgEvents({ events, onOpenEvent, isOwner, onCreateEvent }) {
    const upcoming = events.filter((e) => !e.isPast);
    const past = events.filter((e) => e.isPast);
    const [tab, setTab] = useState(upcoming.length ? "upcoming" : "past");
    const list = tab === "upcoming" ? upcoming : past;

    return (
      React.createElement("div", { className: "org-events" },
        React.createElement("div", { className: "match-tabs" },
          React.createElement("button", { className: "match-tab" + (tab === "upcoming" ? " active" : ""), onClick: () => setTab("upcoming") },
            React.createElement(Icon, { name: "calendar", size: 18 }), "Upcoming",
            upcoming.length > 0 && React.createElement("span", { className: "b" }, upcoming.length)),
          React.createElement("button", { className: "match-tab" + (tab === "past" ? " active" : ""), onClick: () => setTab("past") },
            React.createElement(Icon, { name: "clock", size: 18 }), "Past",
            past.length > 0 && React.createElement("span", { className: "b" }, past.length))
        ),
        list.length
          ? React.createElement("div", { className: "event-list" },
              list.map((e) => React.createElement(EventRow, { key: e.id, e, onOpen: onOpenEvent })))
          : React.createElement("div", { className: "org-empty" },
              React.createElement(Icon, { name: "calendar", size: 34, stroke: "var(--accent)" }),
              React.createElement("p", null, tab === "upcoming" ? "No upcoming events yet." : "No past events."),
              isOwner && tab === "upcoming" && React.createElement("button", { className: "btn btn-primary", style: { marginTop: 14 }, onClick: onCreateEvent },
                React.createElement(Icon, { name: "plus", size: 16, stroke: "var(--paper)" }), "Pin an event"))
      )
    );
  }

  function OrgProfile({ org, events = [], isOwner, following, onBack, onOpenEvent, onManage, onCreateEvent, onFollow }) {
    if (!org) return null;
    const uniName = org.uni && UNI[org.uni] ? UNI[org.uni].name : null;
    const meta = [orgSub(org), org.location].filter(Boolean).join(" · ");

    return (
      React.createElement("div", { className: "org-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Your orgs")
        ),

        React.createElement("div", { className: "org-page grain fade-up" },
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
                  meta,
                  org.verified
                    ? React.createElement("span", { className: "org-badge ok" }, React.createElement(Icon, { name: "check", size: 12, stroke: "var(--paper)", width: 3 }), "Verified")
                    : React.createElement("span", { className: "org-badge pend" }, React.createElement(Icon, { name: "clock", size: 12, stroke: "currentColor" }), "Pending review")
                )
              )
            ),

            org.bio && React.createElement("p", { className: "org-bio" }, org.bio),

            (org.website || org.instagram) && React.createElement("div", { className: "org-links" },
              org.website && React.createElement("a", { className: "linkpill", href: safeUrl(org.website), target: "_blank", rel: "noreferrer", onClick: (e) => e.stopPropagation() },
                React.createElement(Icon, { name: "globe", size: 14 }), org.website.replace(/^https?:\/\//, "")),
              org.instagram && React.createElement("a", { className: "linkpill", href: "https://instagram.com/" + org.instagram, target: "_blank", rel: "noreferrer", onClick: (e) => e.stopPropagation() },
                React.createElement(Icon, { name: "camera", size: 14 }), "@" + org.instagram)
            ),

            React.createElement("div", { className: "org-cta" },
              isOwner
                ? [
                    React.createElement("span", { key: "y", className: "owner-chip" },
                      React.createElement(Icon, { name: "check", size: 13, stroke: "var(--accent)", width: 2.4 }), "You manage this org"),
                    org.verified && React.createElement("button", { key: "c", className: "btn btn-primary", onClick: onCreateEvent },
                      React.createElement(Icon, { name: "plus", size: 17, stroke: "var(--paper)" }), "Pin an event"),
                  ]
                : [
                    React.createElement("button", { key: "f", className: "btn " + (following ? "btn-primary done" : "btn-primary"), onClick: () => onFollow && onFollow(org) },
                      following
                        ? [React.createElement(Icon, { name: "check", size: 17, stroke: "var(--paper)", key: "i" }), "Following"]
                        : [React.createElement(Icon, { name: "plus", size: 17, stroke: "var(--paper)", key: "i" }), "Follow"]),
                    org.website && React.createElement("a", { key: "w", className: "btn btn-ghost", href: safeUrl(org.website), target: "_blank", rel: "noreferrer" },
                      React.createElement(Icon, { name: "external", size: 16 }), "Visit site"),
                  ]
            ),

            React.createElement("div", { className: "org-section" },
              React.createElement("div", { className: "sec-h" }, "Events from " + org.name.split(" ")[0]),
              React.createElement(OrgEvents, { events, onOpenEvent, isOwner, onCreateEvent })
            )
          )
        )
      )
    );
  }

  export { OrgProfile, OrgCard, EventRow, orgSub };
  export default OrgProfile;
