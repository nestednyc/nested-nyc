/* ============================================================
   NESTED NYC — People (the student directory)
   One ranked grid of every student on the board — search it, filter
   it by campus, connect with people, and message any student
   directly (or reach out via the links they post).
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI, LINK_ICON } from './data'
import { UniLogo, Skeleton, Polaroid } from './shared'

  const { useState } = React;

  function LinkPill({ link }) {
    // email → mailto; instagram → canonical profile URL from the bare handle;
    // everything else is a full https URL → open in a new tab. An explicit
    // link.url (project links, the team-chat pill) wins over deriving from
    // the display label — the label is then a human caption, not an address.
    const isEmail = link.kind === "email";
    const raw = link.url
      || (link.kind === "instagram"
        ? "https://instagram.com/" + String(link.label).replace(/^@+/, "").trim()
        : link.label);
    const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    const href = isEmail ? "mailto:" + link.label : url;
    return (
      React.createElement("a", {
        className: "linkpill", href, title: link.url || link.label,
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

  function People({ connected = [], onConnect, onMessage, people = [], loading = false, error = null, onRetry, onOpenPerson }) {
    // Controlled: NestedApp owns the connection set (optimistic + revert, like
    // toggleSave). We read it and call the handlers; no local connection state.
    // Opening a profile navigates to /u/:username via onOpenPerson.
    const connSet = new Set(connected);

    // Directory filters — deliberately local: leaving the page resets them.
    const [query, setQuery] = useState("");
    const [campus, setCampus] = useState("all");

    // Campus chips cover only campuses with students on the board, busiest
    // first (name as the tiebreak so equal counts keep a stable order).
    const uniCounts = {};
    for (const p of people) uniCounts[p.uni] = (uniCounts[p.uni] || 0) + 1;
    const campuses = Object.keys(uniCounts)
      .sort((a, b) => uniCounts[b] - uniCounts[a] || UNI[a].name.localeCompare(UNI[b].name));

    // Filtering trims the ranked list in place, so peopleRank's order carries
    // through to whatever survives the search + campus chip.
    const q = query.trim().toLowerCase();
    const shown = people.filter((p) => {
      if (campus !== "all" && p.uni !== campus) return false;
      if (!q) return true;
      const hay = [
        p.name, "@" + p.handle, p.bio, p.major, p.building,
        UNI[p.uni].name, UNI[p.uni].full, ...p.skills, ...p.interests,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const clearFilters = () => { setQuery(""); setCampus("all"); };

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
    } else if (!people.length) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "users", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "No other students yet"),
        React.createElement("p", null, "You're early. As more students join Nested and complete their profiles, they'll show up here to browse and connect with."));
    } else if (!shown.length) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "search", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "Nobody matches"),
        React.createElement("p", null,
          q
            ? "No one matches \u201c" + query.trim() + "\u201d" + (campus !== "all" ? " at " + UNI[campus].name : "") + ". Try another search or clear the filters."
            : "No students from " + UNI[campus].name + " are on the board right now."),
        React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: clearFilters },
          React.createElement(Icon, { name: "users", size: 16, stroke: "var(--paper)" }), "Show everyone"));
    } else {
      body = React.createElement("div", { className: "people-grid" },
        shown.map((p) => React.createElement(PersonCard, { key: p.id, person: p, connected: connSet.has(p.id), onConnect, onMessage, onOpen: onOpenPerson })));
    }

    // Toolbar + stat only render once there are real people to filter — the
    // skeleton, error, and you're-early states keep the page quiet.
    const ready = !loading && !error && people.length > 0;

    return (
      React.createElement("div", { className: "people" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Find your ", React.createElement("em", null, "people")),
            React.createElement("p", { className: "sub" }, "Students across NYC looking to build with someone. Search the board, filter by campus, and reach out to the people you click with.")
          ),
          ready && React.createElement("div", { className: "people-stat" },
            shown.length !== people.length
              ? shown.length + " of " + people.length + (people.length === 1 ? " student" : " students")
              : people.length + (people.length === 1 ? " student" : " students") + " · " + campuses.length + (campuses.length === 1 ? " campus" : " campuses"))
        ),
        ready && React.createElement("div", { className: "people-tools" },
          React.createElement("label", { className: "people-search" },
            React.createElement(Icon, { name: "search", size: 17 }),
            React.createElement("input", {
              type: "search",
              value: query,
              onChange: (e) => setQuery(e.target.value),
              placeholder: "Search people, skills, majors…",
              "aria-label": "Search people",
            })
          ),
          React.createElement("div", { className: "people-chips" },
            React.createElement("button", { className: "chip-filter" + (campus === "all" ? " active" : ""), onClick: () => setCampus("all") },
              React.createElement(Icon, { name: "users", size: 17 }), "All",
              React.createElement("span", { className: "count" }, people.length)),
            campuses.map((id) => (
              React.createElement("button", {
                key: id,
                className: "chip-filter" + (campus === id ? " active" : ""),
                onClick: () => setCampus(id),
                title: UNI[id].full,
              },
                React.createElement(UniLogo, { uni: UNI[id], size: 16, radius: "26%" }),
                UNI[id].name,
                React.createElement("span", { className: "count" }, uniCounts[id]))
            ))
          )
        ),
        body
      )
    );
  }

  export { People, ContactLinks, LinkPill, PersonProfile };
  export default People;
