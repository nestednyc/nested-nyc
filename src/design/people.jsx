/* ============================================================
   NESTED NYC — People (discover collaborators)
   Swipe or browse student profiles. Reach out through the
   links people post — there is no in-app messaging.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { PEOPLE, ROLE, UNI, LINK_ICON, avColor, initials } from './data'
import { Av } from './shared'

  const { useState, useRef } = React;

  function Polaroid({ label }) {
    return (
      React.createElement("div", { className: "polaroid" },
        React.createElement("div", { className: "ph" }, React.createElement("span", { className: "pl" }, label)),
        React.createElement("div", { className: "cap" }, label)
      )
    );
  }

  function RoleBadge({ role }) {
    const r = ROLE[role];
    return React.createElement("span", { className: "rolebadge", style: { background: "color-mix(in oklch, " + r.color + " 16%, transparent)", color: r.color } },
      React.createElement("span", { style: { width: 6, height: 6, borderRadius: "50%", background: r.color } }), r.label);
  }

  function LinkPill({ link, onContact }) {
    const href = link.kind === "email" ? "mailto:" + link.label : "#";
    return (
      React.createElement("a", {
        className: "linkpill", href, target: "_blank", rel: "noreferrer",
        onClick: (e) => { if (link.kind !== "email") e.preventDefault(); if (onContact) onContact(link); },
      },
        React.createElement(Icon, { name: LINK_ICON[link.kind] || "external", size: 15 }),
        link.label,
        link.kind !== "email" && React.createElement(Icon, { name: "external", size: 13, stroke: "var(--ink-faint)" })
      )
    );
  }

  function ContactLinks({ person, onContact }) {
    const raw = person.links || [];
    // Accept either the legacy [{kind, label}] array OR the JSONB object shape
    // ({github, portfolio, linkedin, discord}). Render uniformly downstream.
    const links = Array.isArray(raw)
      ? raw
      : Object.entries(raw).filter(([, v]) => v).map(([kind, label]) => ({ kind, label }));
    return (
      React.createElement("div", null,
        React.createElement("div", { className: "contact-note" }, React.createElement(Icon, { name: "link", size: 14 }), "Reach out through their links \u2014 Nested has no DMs"),
        React.createElement("div", { className: "links" }, links.map((l, i) => React.createElement(LinkPill, { key: i, link: l, onContact })))
      )
    );
  }

  // ---- swipe deck ----
  function SwipeDeck({ people, connectedIds, onConnect, onSkip, onOpen, onUndo, history }) {
    const [pos, setPos] = useState(0);
    const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
    const [fly, setFly] = useState(null); // 'left' | 'right'
    const start = useRef({ x: 0, y: 0 });
    const hist = useRef([]);

    const order = people;
    const remaining = order.slice(pos);
    const THRESH = 110;

    function commit(dir) {
      const person = order[pos];
      if (!person) return;
      hist.current.push({ pos, dir });
      if (dir === "right") onConnect(person.id); else onSkip && onSkip(person.id);
      setPos((p) => p + 1);
      setDrag({ x: 0, y: 0, active: false });
      setFly(null);
    }
    function throwCard(dir) {
      if (fly) return;
      setFly(dir);
      setTimeout(() => commit(dir), 300);
    }
    function undo() {
      const last = hist.current.pop();
      if (last == null) return;
      setPos(last.pos);
      if (last.dir === "right") onUndo && onUndo(order[last.pos].id);
      setDrag({ x: 0, y: 0, active: false });
    }

    function down(e) {
      if (fly) return;
      start.current = { x: e.clientX, y: e.clientY };
      setDrag({ x: 0, y: 0, active: true });
      e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!drag.active) return;
      setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
    }
    function up() {
      if (!drag.active) return;
      if (drag.x > THRESH) throwCard("right");
      else if (drag.x < -THRESH) throwCard("left");
      else setDrag({ x: 0, y: 0, active: false });
    }

    if (remaining.length === 0) {
      return (
        React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "users", size: 42, stroke: "var(--accent)" })),
          React.createElement("h3", null, "You've met everyone for now"),
          React.createElement("p", null, "That's the whole room. Check your connections to reach out, or come back as new students join."),
          React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: () => { hist.current = []; setPos(0); } },
            React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Start over")
        )
      );
    }

    return (
      React.createElement("div", null,
        React.createElement("div", { className: "deck-stage" },
          remaining.slice(0, 3).reverse().map((person, ri, arr) => {
            const isTop = ri === arr.length - 1;
            const depth = arr.length - 1 - ri; // 0 top
            let transform, transition = "transform .3s cubic-bezier(.2,.8,.3,1)";
            if (isTop) {
              if (fly) { transform = "translateX(" + (fly === "right" ? 760 : -760) + "px) rotate(" + (fly === "right" ? 26 : -26) + "deg)"; }
              else if (drag.active) { transform = "translate(" + drag.x + "px," + drag.y + "px) rotate(" + (drag.x * 0.05) + "deg)"; transition = "none"; }
              else { transform = "translate(0,0) rotate(0)"; }
            } else {
              transform = "translateY(" + (depth * 12) + "px) scale(" + (1 - depth * 0.04) + ")";
            }
            const stampOp = isTop && drag.active ? Math.min(1, Math.abs(drag.x) / THRESH) : (isTop && fly ? 1 : 0);
            return React.createElement(SwipeCard, {
              key: person.id, person, isTop, transform, transition,
              opacity: isTop ? 1 : 1, stampOp, stampDir: fly || (drag.x > 0 ? "right" : "left"),
              onPointerDown: isTop ? down : undefined, onPointerMove: isTop ? move : undefined,
              onPointerUp: isTop ? up : undefined, onPointerCancel: isTop ? up : undefined,
              onOpen: () => { if (!drag.active && Math.abs(drag.x) < 6) onOpen(person); },
              z: ri + 1,
            });
          })
        ),
        React.createElement("div", { className: "deck-controls" },
          React.createElement("button", { className: "deck-btn skip", title: "Skip", onClick: () => throwCard("left") }, React.createElement(Icon, { name: "skip", size: 26, width: 2.4 })),
          React.createElement("button", { className: "deck-btn undo", title: "Undo", onClick: undo }, React.createElement(Icon, { name: "undo", size: 20 })),
          React.createElement("button", { className: "deck-btn connect", title: "Connect", onClick: () => throwCard("right") }, React.createElement(Icon, { name: "heart", size: 30, width: 2.2 }))
        ),
        React.createElement("div", { className: "deck-hint" }, "drag the card, or tap to skip / connect \u00b7 " + (order.length - pos) + " left")
      )
    );
  }

  function SwipeCard({ person, isTop, transform, transition, stampOp, stampDir, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onOpen, z }) {
    const r = ROLE[person.role];
    return (
      React.createElement("div", {
        className: "swipe-card" + (isTop ? " top" : ""),
        style: { transform, transition, zIndex: z, touchAction: "none" },
        onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
        onClick: isTop ? onOpen : undefined,
      },
        React.createElement("div", { className: "swipe-stamp connect", style: { opacity: stampDir === "right" ? stampOp : 0 } }, "Connect"),
        React.createElement("div", { className: "swipe-stamp skip", style: { opacity: stampDir === "left" ? stampOp : 0 } }, "Skip"),
        React.createElement("div", { className: "cat-bar", style: { background: r.color } }),
        React.createElement("div", { className: "sc-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l }))),
        React.createElement("div", { className: "sc-body" },
          React.createElement("div", { className: "sc-namerow" },
            React.createElement("span", { className: "sc-name" }, person.name),
            React.createElement(RoleBadge, { role: person.role })
          ),
          React.createElement("div", { className: "sc-meta" }, "@" + person.handle + " \u00b7 " + UNI[person.uni].name + " \u00b7 " + person.major + " " + person.year),
          React.createElement("div", { className: "sc-bio" }, person.bio),
          React.createElement("div", { className: "sc-looking" },
            React.createElement(Icon, { name: "search", size: 16 }),
            React.createElement("div", { className: "t" }, React.createElement("b", null, "Looking for: "), person.looking)
          ),
          React.createElement("div", { className: "sc-tags" }, person.skills.slice(0, 5).map((s, i) => React.createElement("span", { className: "tag2", key: i }, s))),
          React.createElement("div", { className: "sc-foot" },
            React.createElement("span", { className: "av-pin" }), "building " + person.building + " \u00b7 " + person.avail)
        )
      )
    );
  }

  // ---- browse grid ----
  function PersonCard({ person, onOpen }) {
    const r = ROLE[person.role];
    return (
      React.createElement("div", { className: "person-card", onClick: () => onOpen(person) },
        React.createElement("div", { className: "cat-bar", style: { background: r.color } }),
        React.createElement("div", { className: "pc-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l }))),
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
            React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" } }, "building " + person.building),
            React.createElement("span", { className: "btn btn-ghost", style: { padding: "7px 13px", fontSize: 13 } }, "View profile")
          )
        )
      )
    );
  }

  // ---- full profile modal ----
  function ProfileModal({ person, connected, onClose, onConnect, onContact }) {
    const r = ROLE[person.role];
    return (
      React.createElement("div", { className: "scrim", onClick: onClose },
        React.createElement("div", { className: "profile-modal", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "cat-bar", style: { background: r.color } }),
          React.createElement("button", { className: "modal-close", onClick: onClose }, React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "pm-inner" },
            React.createElement("div", { className: "pm-photos" }, person.photos.slice(0, 3).map((p, i) => React.createElement(Polaroid, { key: i, label: p.l }))),
            React.createElement("div", { className: "sc-namerow" },
              React.createElement("span", { className: "sc-name", style: { fontSize: 30 } }, person.name),
              React.createElement(RoleBadge, { role: person.role })
            ),
            React.createElement("div", { className: "sc-meta" }, "@" + person.handle + " \u00b7 " + UNI[person.uni].full + " \u00b7 " + person.major + " " + person.year),
            React.createElement("p", { className: "sc-bio", style: { fontSize: 16 } }, person.bio),
            React.createElement("div", { className: "sc-looking" },
              React.createElement(Icon, { name: "search", size: 16 }),
              React.createElement("div", { className: "t" }, React.createElement("b", null, "Looking for: "), person.looking, " \u00b7 building ", React.createElement("b", null, person.building), " \u00b7 ", person.avail)
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
              React.createElement(ContactLinks, { person, onContact })
            ),
            React.createElement("div", { className: "modal-actions", style: { marginTop: 22 } },
              React.createElement("button", { className: "btn " + (connected ? "btn-primary done" : "btn-primary"), style: { flex: 1, padding: 13 }, onClick: () => onConnect(person.id) },
                connected
                  ? [React.createElement(Icon, { name: "check", size: 17, stroke: "var(--paper)", key: "i" }), "Connected"]
                  : [React.createElement(Icon, { name: "heart", size: 17, stroke: "var(--paper)", key: "i" }), "Connect"])
            )
          )
        )
      )
    );
  }

  function People({ connected = [], onConnect, onDisconnect, onToast, incoming = [], initialTab, people = PEOPLE }) {
    const [mode, setMode] = useState(initialTab || "swipe");
    const [modalPerson, setModalPerson] = useState(null);
    // Controlled: NestedApp owns the connection set (optimistic + revert, like
    // toggleSave). We read it and call the handlers; no local connection state.
    const connSet = new Set(connected);
    function addConn(id) { if (connSet.has(id)) return; onConnect && onConnect(id); }
    function removeConn(id) { if (!connSet.has(id)) return; onDisconnect && onDisconnect(id); }
    function toggleConn(id) { connSet.has(id) ? removeConn(id) : addConn(id); }
    function contact(link) { onToast && onToast("Opening " + link.label + " \u2026", "external"); }

    const TABS = [
      { id: "swipe", label: "Swipe", icon: "heart" },
      { id: "browse", label: "Browse", icon: "grid" },
      { id: "connected", label: "Connected", icon: "users", n: connected.length },
      { id: "incoming", label: "Incoming", icon: "bell", n: incoming.length },
    ];

    const connectedPeople = people.filter((p) => connSet.has(p.id));

    let body;
    if (mode === "swipe") {
      body = React.createElement(SwipeDeck, {
        people, connectedIds: connected,
        onConnect: addConn, onSkip: () => {}, onUndo: removeConn,
        onOpen: (p) => setModalPerson(p),
      });
    } else if (mode === "browse") {
      body = React.createElement("div", { className: "people-grid" },
        people.map((p) => React.createElement(PersonCard, { key: p.id, person: p, onOpen: setModalPerson })));
    } else if (mode === "connected") {
      body = connectedPeople.length
        ? React.createElement("div", { className: "conn-grid" },
            connectedPeople.map((p) => (
              React.createElement("div", { className: "conn-card", key: p.id },
                React.createElement("div", { className: "conn-head" },
                  React.createElement(Av, { name: p.name, color: ROLE[p.role].color }),
                  React.createElement("div", { className: "who" },
                    React.createElement("b", null, p.name),
                    React.createElement("small", null, "@" + p.handle + " \u00b7 " + UNI[p.uni].name)),
                  React.createElement("button", { className: "btn btn-ghost", style: { marginLeft: "auto", padding: "7px 12px", fontSize: 13 }, onClick: () => setModalPerson(p) }, "Profile")
                ),
                React.createElement(ContactLinks, { person: p, onContact: contact })
              )
            )))
        : React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "users", size: 42, stroke: "var(--accent)" })),
            React.createElement("h3", null, "No connections yet"),
            React.createElement("p", null, "Swipe right on someone (or hit Connect on a profile) and they'll show up here with their links so you can reach out."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: () => setMode("swipe") },
              React.createElement(Icon, { name: "heart", size: 16, stroke: "var(--paper)" }), "Start swiping"));
    } else if (mode === "incoming") {
      body = incoming.length
        ? React.createElement("div", { className: "conn-grid" },
            incoming.map((p) => {
              const mutual = connSet.has(p.id);
              return React.createElement("div", { className: "conn-card", key: p.id },
                React.createElement("div", { className: "conn-head" },
                  React.createElement(Av, { name: p.name, color: ROLE[p.role].color }),
                  React.createElement("div", { className: "who" },
                    React.createElement("b", null, p.name),
                    React.createElement("small", null, "@" + p.handle + " · " + UNI[p.uni].name)),
                  React.createElement("button", {
                    className: "btn " + (mutual ? "btn-primary done" : "btn-primary"),
                    style: { marginLeft: "auto", padding: "7px 13px", fontSize: 13 },
                    onClick: () => { if (!mutual) addConn(p.id); },
                  }, mutual
                    ? [React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)", key: "i" }), "Mutual"]
                    : [React.createElement(Icon, { name: "heart", size: 15, stroke: "var(--paper)", key: "i" }), "Connect back"])
                ),
                React.createElement(ContactLinks, { person: p, onContact: contact })
              );
            }))
        : React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "bell", size: 42, stroke: "var(--accent)" })),
            React.createElement("h3", null, "No incoming connections yet"),
            React.createElement("p", null, "When another student connects with you, they show up here with their links — connect back, or reach out directly."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: () => setMode("swipe") },
              React.createElement(Icon, { name: "heart", size: 16, stroke: "var(--paper)" }), "Find people"));
    }

    return (
      React.createElement("div", { className: "people" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Find your ", React.createElement("em", null, "people")),
            React.createElement("p", { className: "sub" }, "Students across NYC looking to build with someone. Swipe or browse, then reach out through the links they posted \u2014 no DMs here, just real connections.")
          )
        ),
        React.createElement("div", { className: "match-tabs" },
          TABS.map((t) => (
            React.createElement("button", { key: t.id, className: "match-tab" + (mode === t.id ? " active" : ""), onClick: () => setMode(t.id) },
              React.createElement(Icon, { name: t.icon, size: 18 }), t.label,
              t.n > 0 && React.createElement("span", { className: "b" }, t.n))
          ))
        ),
        body,
        modalPerson && React.createElement(ProfileModal, {
          person: modalPerson, connected: connSet.has(modalPerson.id),
          onClose: () => setModalPerson(null), onConnect: toggleConn, onContact: contact,
        })
      )
    );
  }

  export { People, ContactLinks, ProfileModal };
  export default People;
