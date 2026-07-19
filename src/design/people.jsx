/* ============================================================
   NESTED NYC — People (discover collaborators)
   Browse student profiles, connect with people, and message any
   student directly (or reach out via the links they post).
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI, LINK_ICON, avColor, initials } from './data'
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
        React.createElement("div", { className: "contact-note" }, React.createElement(Icon, { name: "link", size: 14 }), "Reach out through their links"),
        React.createElement("div", { className: "links" }, links.map((l, i) => React.createElement(LinkPill, { key: i, link: l })))
      )
    );
  }

  // ---- browse grid ----
  function PersonCard({ person, connected = false, onConnect, onMessage, onOpen }) {
    // The card body opens the profile; the action buttons stopPropagation so they
    // don't also navigate. Connect mirrors the profile (connect-only; shows
    // "Connected" once done). Message is open to anyone \u2014 no connection required.
    const stop = (fn) => (e) => { e.stopPropagation(); fn && fn(); };
    return (
      React.createElement("div", { className: "person-card", onClick: () => onOpen(person) },
        React.createElement("div", { className: "pc-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l, src: p.src }))),
        React.createElement("div", { className: "pc-body" },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 } },
            React.createElement("div", null,
              React.createElement("div", { className: "pc-name" }, person.name),
              React.createElement("div", { className: "pc-meta" }, "@" + person.handle + " \u00b7 " + UNI[person.uni].name)
            )
          ),
          React.createElement("div", { className: "pc-bio" }, person.bio),
          person.building && React.createElement("div", { className: "pc-foot" },
            React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" } },
              "building " + person.building)
          ),
          React.createElement("div", { className: "pc-actions" },
            React.createElement("button", {
              className: "btn " + (connected ? "btn-primary done" : "btn-primary"),
              onClick: stop(() => onConnect && onConnect(person.id)),
              title: connected ? "Connected" : "Connect with @" + person.handle,
            },
              connected
                ? [React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)", key: "i" }), "Connected"]
                : [React.createElement(Icon, { name: "heart", size: 15, stroke: "var(--paper)", key: "i" }), "Connect"]),
            onMessage && React.createElement("button", {
              className: "btn btn-ghost", onClick: stop(() => onMessage(person)), title: "Message @" + person.handle,
            },
              React.createElement(Icon, { name: "chat", size: 15, key: "i" }), "Message")
          )
        )
      )
    );
  }

  // ---- full profile body ----
  // The card's inner content, shared by the /u/:username page (userProfile.jsx)
  // which wraps it in a backbar + paper shell. Pass showConnect:false to hide
  // the action row (e.g. viewing yourself).
  function PersonProfile({ person, connected, canMessage, onConnect, onMessage, isBlocked = false, onBlock, onUnblock, showConnect = true }) {
    // `connected` drives the Connect/Disconnect toggle (the viewer's OUTGOING
    // edge). Messaging no longer requires a connection — `canMessage` is set by
    // the caller (true for anyone but yourself); falls back to `connected` if unset.
    const messageable = canMessage === undefined ? connected : canMessage;
    return (
      React.createElement("div", { className: "pm-inner" },
        React.createElement("div", { className: "pm-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l, src: p.src }))),
        React.createElement("div", { className: "sc-namerow" },
          React.createElement("span", { className: "sc-name", style: { fontSize: 30 } }, person.name)
        ),
        React.createElement("div", { className: "sc-meta" }, "@" + person.handle + " \u00b7 " + UNI[person.uni].full + " \u00b7 " + person.major + " " + person.year),
        React.createElement("p", { className: "sc-bio", style: { fontSize: 16 } }, person.bio),
        person.building && React.createElement("div", { className: "sc-looking" },
          React.createElement("div", { className: "t" },
            "Building ",
            React.createElement("b", null, person.building)
          )
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
              : [React.createElement(Icon, { name: "heart", size: 17, stroke: "var(--paper)", key: "i" }), "Connect"]),
          // Messaging no longer requires a connection — shown for any non-self viewer (canMessage).
          messageable && onMessage && React.createElement("button", { className: "btn btn-ghost", style: { flex: 1, padding: 13 }, onClick: () => onMessage(person) },
            React.createElement(Icon, { name: "chat", size: 17, key: "i" }), "Message")
        )
      )
    );
  }

  function People({ connected = [], onConnect, onDisconnect, onMessage, people = [], loading = false, error = null, onRetry, onOpenPerson }) {
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
            people.map((p) => React.createElement(PersonCard, { key: p.id, person: p, connected: connSet.has(p.id), onConnect, onMessage, onOpen: onOpenPerson })))
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
                  React.createElement(Av, { name: p.name, img: p.avatar }),
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
            React.createElement("p", { className: "sub" }, "Students across NYC looking to build with someone. Browse, connect, and message the people you click with.")
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
