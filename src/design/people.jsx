/* ============================================================
   NESTED NYC — People (discover collaborators)
   Browse student profiles. Reach out through the
   links people post — there is no in-app messaging.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ROLE, UNI, LINK_ICON, avColor, initials } from './data'
import { Av, Skeleton } from './shared'

  const { useState } = React;

  function Polaroid({ label, src }) {
    return (
      React.createElement("div", { className: "polaroid" },
        React.createElement("div", { className: "ph" },
          src
            ? React.createElement("img", {
                className: "pimg", src, alt: label, loading: "lazy", draggable: false,
                style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
              })
            : React.createElement("span", { className: "pl" }, label)
        ),
        React.createElement("div", { className: "cap" }, label)
      )
    );
  }

  function RoleBadge({ role }) {
    const r = ROLE[role];
    return React.createElement("span", { className: "rolebadge", style: { background: "color-mix(in oklch, " + r.color + " 16%, transparent)", color: r.color } },
      React.createElement("span", { style: { width: 6, height: 6, borderRadius: "50%", background: r.color } }), r.label);
  }

  function LinkPill({ link }) {
    // email → mailto; instagram → canonical profile URL from the bare handle;
    // everything else is a full https URL → open in a new tab.
    const isEmail = link.kind === "email";
    const url = link.kind === "instagram"
      ? "https://instagram.com/" + String(link.label).replace(/^@+/, "").trim()
      : (/^https?:\/\//i.test(link.label) ? link.label : "https://" + link.label);
    const href = isEmail ? "mailto:" + link.label : url;
    return (
      React.createElement("a", {
        className: "linkpill", href, title: link.label,
        target: isEmail ? undefined : "_blank", rel: "noreferrer",
      },
        React.createElement(Icon, { name: LINK_ICON[link.kind] || "external", size: 15 }),
        React.createElement("span", { className: "linkpill-label" }, link.label),
        !isEmail && React.createElement(Icon, { name: "external", size: 13, stroke: "var(--ink-faint)" })
      )
    );
  }

  function ContactLinks({ person }) {
    const raw = person.links || [];
    // Accept either the legacy [{kind, label}] array OR the JSONB object shape
    // ({github, portfolio, linkedin, instagram}). Render uniformly downstream.
    const links = Array.isArray(raw)
      ? raw
      : Object.entries(raw).filter(([, v]) => v).map(([kind, label]) => ({ kind, label }));
    return (
      React.createElement("div", null,
        React.createElement("div", { className: "contact-note" }, React.createElement(Icon, { name: "link", size: 14 }), "Reach out through their links \u2014 Nested has no DMs"),
        React.createElement("div", { className: "links" }, links.map((l, i) => React.createElement(LinkPill, { key: i, link: l })))
      )
    );
  }

  // ---- browse grid ----
  function PersonCard({ person, onOpen }) {
    const r = ROLE[person.role];
    return (
      React.createElement("div", { className: "person-card", onClick: () => onOpen(person) },
        React.createElement("div", { className: "cat-bar", style: { background: r.color } }),
        React.createElement("div", { className: "pc-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l, src: p.src }))),
        React.createElement("div", { className: "pc-body" },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } },
            React.createElement("div", null,
              React.createElement("div", { className: "pc-name" }, person.name),
              React.createElement("div", { className: "pc-meta" }, "@" + person.handle + " \u00b7 " + UNI[person.uni].name)
            ),
            React.createElement(RoleBadge, { role: person.role })
          ),
          React.createElement("div", { className: "pc-bio" }, person.bio),
          React.createElement("div", { className: "pc-foot" },
            React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" } },
              person.building ? "building " + person.building : ""),
            React.createElement("span", { className: "btn btn-ghost", style: { padding: "7px 13px", fontSize: 13 } }, "View profile")
          )
        )
      )
    );
  }

  // ---- full profile body ----
  // The card's inner content, shared by the /u/:username page (userProfile.jsx)
  // which wraps it in a backbar + paper shell. Pass showConnect:false to hide
  // the action row (e.g. viewing yourself).
  function PersonProfile({ person, connected, onConnect, showConnect = true }) {
    return (
      React.createElement("div", { className: "pm-inner" },
        React.createElement("div", { className: "pm-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l, src: p.src }))),
        React.createElement("div", { className: "sc-namerow" },
          React.createElement("span", { className: "sc-name", style: { fontSize: 30 } }, person.name),
          React.createElement(RoleBadge, { role: person.role })
        ),
        React.createElement("div", { className: "sc-meta" }, "@" + person.handle + " \u00b7 " + UNI[person.uni].full + " \u00b7 " + person.major + " " + person.year),
        React.createElement("p", { className: "sc-bio", style: { fontSize: 16 } }, person.bio),
        (person.building || person.avail) && React.createElement("div", { className: "sc-looking" },
          React.createElement(Icon, { name: "pin", size: 16 }),
          React.createElement("div", { className: "t" }, [
            person.building ? "Building " : null,
            person.building ? React.createElement("b", { key: "b" }, person.building) : null,
            (person.building && person.avail) ? " \u00b7 " : null,
            person.avail || null,
          ].filter(Boolean))
        ),
        React.createElement("div", { className: "pm-section" },
          React.createElement("div", { className: "sec-h" }, "Skills"),
          React.createElement("div", { className: "links" }, person.skills.map((s, i) => React.createElement("span", { className: "tag2", key: i }, s)))
        ),
        React.createElement("div", { className: "pm-section" },
          React.createElement("div", { className: "sec-h" }, "Into"),
          React.createElement("div", { className: "links" }, person.interests.map((s, i) => React.createElement("span", { className: "tag2", key: i }, s)))
        ),
        React.createElement("div", { className: "pm-section" },
          React.createElement("div", { className: "sec-h" }, "Get in touch"),
          React.createElement(ContactLinks, { person })
        ),
        showConnect && React.createElement("div", { className: "modal-actions", style: { marginTop: 22 } },
          React.createElement("button", { className: "btn " + (connected ? "btn-primary done" : "btn-primary"), style: { flex: 1, padding: 13 }, onClick: () => onConnect(person.id) },
            connected
              ? [React.createElement(Icon, { name: "check", size: 17, stroke: "var(--paper)", key: "i" }), "Connected"]
              : [React.createElement(Icon, { name: "heart", size: 17, stroke: "var(--paper)", key: "i" }), "Connect"])
        )
      )
    );
  }

  function People({ connected = [], onConnect, onDisconnect, people = [], loading = false, error = null, onRetry, onOpenPerson }) {
    const [mode, setMode] = useState("browse");
    // Controlled: NestedApp owns the connection set (optimistic + revert, like
    // toggleSave). We read it and call the handlers; no local connection state.
    // Opening a profile navigates to /u/:username via onOpenPerson — the old
    // in-page modal is gone.
    const connSet = new Set(connected);

    const TABS = [
      { id: "browse", label: "Browse", icon: "grid" },
      { id: "connected", label: "Connected", icon: "users", n: connected.length },
    ];

    const connectedPeople = people.filter((p) => connSet.has(p.id));

    let body;
    if (loading) {
      body = React.createElement(Skeleton, { count: 6 });
    } else if (error) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "refresh", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "Couldn't load people"),
        React.createElement("p", null, "Something went wrong reaching Nested. Check your connection and try again."),
        React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onRetry },
          React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Try again"));
    } else if (mode === "browse") {
      body = people.length
        ? React.createElement("div", { className: "people-grid" },
            people.map((p) => React.createElement(PersonCard, { key: p.id, person: p, onOpen: onOpenPerson })))
        : React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "users", size: 42, stroke: "var(--accent)" })),
            React.createElement("h3", null, "No other students yet"),
            React.createElement("p", null, "You're early. As more students join Nested and complete their profiles, they'll show up here to browse and connect with."));
    } else if (mode === "connected") {
      body = connectedPeople.length
        ? React.createElement("div", { className: "conn-grid" },
            connectedPeople.map((p) => (
              React.createElement("div", { className: "conn-card", key: p.id },
                React.createElement("div", { className: "conn-head" },
                  React.createElement(Av, { name: p.name, color: ROLE[p.role].color, img: p.avatar }),
                  React.createElement("div", { className: "who" },
                    React.createElement("b", null, p.name),
                    React.createElement("small", null, "@" + p.handle + " \u00b7 " + UNI[p.uni].name)),
                  React.createElement("button", { className: "btn btn-ghost", style: { marginLeft: "auto", padding: "7px 12px", fontSize: 13 }, onClick: () => onOpenPerson && onOpenPerson(p) }, "Profile")
                ),
                React.createElement(ContactLinks, { person: p })
              )
            )))
        : React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "users", size: 42, stroke: "var(--accent)" })),
            React.createElement("h3", null, "No connections yet"),
            React.createElement("p", null, "Hit Connect on someone's profile and they'll show up here with their links so you can reach out."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: () => setMode("browse") },
              React.createElement(Icon, { name: "grid", size: 16, stroke: "var(--paper)" }), "Browse people"));
    }

    return (
      React.createElement("div", { className: "people" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Find your ", React.createElement("em", null, "people")),
            React.createElement("p", { className: "sub" }, "Students across NYC looking to build with someone. Browse, then reach out through the links they posted \u2014 no DMs here, just real connections.")
          )
        ),
        React.createElement("div", { className: "match-tabs" },
          TABS.map((t) => (
            React.createElement("button", { key: t.id, className: "match-tab" + (mode === t.id ? " active" : ""), onClick: () => setMode(t.id) },
              React.createElement(Icon, { name: t.icon, size: 18 }), t.label,
              t.n > 0 && React.createElement("span", { className: "b" }, t.n))
          ))
        ),
        body
      )
    );
  }

  export { People, ContactLinks, PersonProfile };
  export default People;
