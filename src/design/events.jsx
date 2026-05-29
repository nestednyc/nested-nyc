/* ============================================================
   NESTED NYC — Events (agenda across NYC campuses)
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { EVENTS, EVENT_TYPES, ETYPE, UNI } from './data'
import { Facepile, CatTag } from './shared'

  const { useState } = React;

  function EventCard({ e, going, onRSVP }) {
    const ty = ETYPE[e.type];
    const extra = Math.max(0, e.going - e.goingNames.length);
    return (
      React.createElement("div", { className: "ev-card grain", onClick: () => onRSVP(e.id) },
        React.createElement("div", { className: "ev-date" },
          React.createElement("div", { className: "mon" }, e.mon),
          React.createElement("div", { className: "day" }, e.day),
          React.createElement("div", { className: "wd" }, e.weekday)
        ),
        React.createElement("div", { className: "ev-main" },
          React.createElement("div", { className: "ev-top" },
            React.createElement(CatTag, { cat: ty }),
            React.createElement("span", { className: "ev-host" }, e.host)
          ),
          React.createElement("h3", null, e.title),
          React.createElement("p", { className: "ev-blurb" }, e.blurb),
          React.createElement("div", { className: "ev-meta" },
            React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "clock", size: 15 }), e.time),
            React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "map", size: 15 }), e.place),
            React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "user", size: 15 }), UNI[e.uni].name)
          )
        ),
        React.createElement("div", { className: "ev-right" },
          React.createElement("div", { className: "ev-going" },
            React.createElement(Facepile, { names: e.goingNames.slice(0, 3), extra }),
            React.createElement("span", { className: "txt" }, e.going + " going")
          ),
          React.createElement("button", {
            className: "rsvp" + (going ? " on" : ""),
            onClick: (ev) => { ev.stopPropagation(); onRSVP(e.id); },
          }, going
            ? [React.createElement(Icon, { name: "check", size: 16, stroke: "var(--paper)", key: "i" }), "Going"]
            : [React.createElement(Icon, { name: "plus", size: 16, key: "i" }), "RSVP"])
        )
      )
    );
  }

  function Events({ rsvped, onRSVP }) {
    const [type, setType] = useState("all");
    const list = EVENTS.filter((e) => type === "all" || e.type === type);
    const groups = [];
    list.forEach((e) => {
      let g = groups.find((x) => x.label === e.group);
      if (!g) { g = { label: e.group, items: [] }; groups.push(g); }
      g.items.push(e);
    });

    return (
      React.createElement("div", { className: "discover" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "What's ", React.createElement("em", null, "happening"), " on campus"),
            React.createElement("p", { className: "sub" }, "Hackathons, demo days, mixers and workshops across every NYC campus on Nested — one shared calendar.")
          )
        ),
        React.createElement("div", { className: "ev-filters" },
          React.createElement("button", { className: "chip-filter" + (type === "all" ? " active" : ""), onClick: () => setType("all") },
            React.createElement(Icon, { name: "calendar", size: 17 }), "All events",
            React.createElement("span", { className: "count" }, EVENTS.length)
          ),
          EVENT_TYPES.map((t) => (
            React.createElement("button", { key: t.id, className: "chip-filter" + (type === t.id ? " active" : ""), onClick: () => setType(t.id) },
              React.createElement(Icon, { name: t.icon, size: 17, stroke: type === t.id ? "var(--paper)" : t.color }),
              t.label
            )
          ))
        ),
        React.createElement("div", { className: "events", style: { padding: 0 } },
          groups.map((g) => (
            React.createElement("div", { className: "day-group", key: g.label },
              React.createElement("div", { className: "day-label" }, g.label, React.createElement("span", { className: "n" }, g.items.length + (g.items.length === 1 ? " event" : " events"))),
              g.items.map((e) => React.createElement(EventCard, { key: e.id, e, going: rsvped.has(e.id), onRSVP }))
            )
          ))
        )
      )
    );
  }

  export { Events };
  export default Events;
