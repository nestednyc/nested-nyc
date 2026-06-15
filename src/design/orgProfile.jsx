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
import { Av, Facepile, CatTag, Stamp, UniLogo } from './shared'

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

  // Events split into Upcoming / Past as two labeled lists (no sticky tab bar —
  // an org page is usually a handful of events; the segmented control was wrong
  // altitude). Empty → the dashed-paper empty state.
  function OrgEvents({ events, onOpenEvent }) {
    const upcoming = events.filter((e) => !e.isPast);
    const past = events.filter((e) => e.isPast);

    if (!upcoming.length && !past.length) {
      return React.createElement("div", { className: "org-empty" },
        React.createElement(Icon, { name: "calendar", size: 34, stroke: "var(--accent)" }),
        React.createElement("p", null, "No events yet."));
    }

    return (
      React.createElement("div", { className: "org-events" },
        React.createElement("div", { className: "sec-h" }, "Upcoming"),
        upcoming.length
          ? React.createElement("div", { className: "event-list" },
              upcoming.map((e) => React.createElement(EventRow, { key: e.id, e, onOpen: onOpenEvent })))
          : React.createElement("div", { className: "org-empty" }, React.createElement("p", null, "Nothing coming up right now.")),
        past.length > 0 && React.createElement("div", { className: "sec-h", style: { marginTop: 30 } }, "Past"),
        past.length > 0 && React.createElement("div", { className: "event-list" },
          past.map((e) => React.createElement(EventRow, { key: e.id, e, onOpen: onOpenEvent })))
      )
    );
  }

  // The public org page — a campus-colored paper poster pinned to the cork
  // board. Visitor-only (the owner manages from the dashboard; there's no
  // owner variant of this page anymore). Campus identity (color + logo) comes
  // from UNI[org.uni] when the org's university resolves, else the accent.
  function OrgProfile({ org, events = [], following, onBack, onOpenEvent, onFollow }) {
    if (!org) return null;
    const uniObj = org.uni && UNI[org.uni] ? UNI[org.uni] : null;
    const barColor = uniObj ? uniObj.color : "var(--accent)";
    const meta = [orgSub(org), org.location].filter(Boolean).join(" · ");

    return (
      React.createElement("div", { className: "org-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Back")
        ),

        React.createElement("article", { className: "org-page org-poster grain fade-up" },
          React.createElement("div", { className: "cat-bar", style: { background: barColor } }),
          org.verified && React.createElement(Stamp, { size: 96, label: "ORG", className: "detail-stamp" }),

          React.createElement("div", { className: "org-inner" },
            React.createElement("div", { className: "org-headline" },
              uniObj
                ? React.createElement(UniLogo, { uni: uniObj, size: 60, radius: "24%" })
                : React.createElement(Av, { name: org.name, size: 60 }),
              React.createElement("div", { className: "org-id", style: { minWidth: 0 } },
                React.createElement("h1", null, org.name),
                meta && React.createElement("span", { className: "org-sub" }, meta)
              )
            ),

            org.bio && React.createElement("p", { className: "org-bio" }, org.bio),

            (org.website || org.instagram) && React.createElement("div", { className: "org-links" },
              org.website && React.createElement("a", { className: "linkpill", href: safeUrl(org.website), target: "_blank", rel: "noreferrer" },
                React.createElement(Icon, { name: "globe", size: 14 }), org.website.replace(/^https?:\/\//, "")),
              org.instagram && React.createElement("a", { className: "linkpill", href: "https://instagram.com/" + org.instagram, target: "_blank", rel: "noreferrer" },
                React.createElement(Icon, { name: "camera", size: 14 }), "@" + org.instagram)
            ),

            React.createElement("div", { className: "org-cta" },
              React.createElement("button", { className: "btn " + (following ? "btn-primary done" : "btn-primary"), onClick: () => onFollow && onFollow(org) },
                following
                  ? [React.createElement(Icon, { name: "check", size: 17, stroke: "var(--paper)", key: "i" }), "Following"]
                  : [React.createElement(Icon, { name: "plus", size: 17, stroke: "var(--paper)", key: "i" }), "Follow"]),
              org.website && React.createElement("a", { className: "btn btn-ghost", href: safeUrl(org.website), target: "_blank", rel: "noreferrer" },
                React.createElement(Icon, { name: "external", size: 16 }), "Visit site")
            ),

            React.createElement("div", { className: "org-section" },
              React.createElement(OrgEvents, { events, onOpenEvent })
            )
          )
        )
      )
    );
  }

  export { OrgProfile, OrgCard, EventRow, orgSub };
  export default OrgProfile;
