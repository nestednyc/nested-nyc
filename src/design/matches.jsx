/* ============================================================
   NESTED NYC — Matches (saved · requests · my projects)
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT } from './data'
import { Pin } from './shared'
import { ProjectCard } from './discover'

  const { useState } = React;

  function EmptyState({ icon, title, body, cta, onCta, pin }) {
    return (
      React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, pin && React.createElement(Pin, null), React.createElement(Icon, { name: icon, size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, title),
        React.createElement("p", null, body),
        cta && React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onCta },
          React.createElement(Icon, { name: "arrowRight", size: 16, stroke: "var(--paper)" }), cta)
      )
    );
  }

  function Matches({ projects = [], profile, saved, joined, onOpen, onSave, onStart, onBrowse }) {
    const [tab, setTab] = useState("saved");
    const savedList = projects.filter((p) => saved.has(p.id));
    const reqList = projects.filter((p) => joined.has(p.id));
    const myName = profile && profile.username;
    const mineList = myName ? projects.filter((p) => p.lead && p.lead.name === myName) : [];

    const TABS = [
      { id: "saved", label: "Saved", icon: "bookmark", n: savedList.length },
      { id: "requests", label: "Requests", icon: "send", n: reqList.length },
      { id: "mine", label: "My projects", icon: "pin", n: mineList.length },
    ];

    let body;
    if (tab === "saved") {
      body = savedList.length
        ? React.createElement("div", { className: "board" },
            savedList.map((p) => React.createElement(ProjectCard, { key: p.id, p, saved: true, joined: joined.has(p.id), onOpen, onSave })))
        : React.createElement(EmptyState, { icon: "bookmark", title: "Nothing saved yet", body: "Tap the bookmark on any project to pin it here for later.", cta: "Browse the board", onCta: onBrowse });
    } else if (tab === "requests") {
      body = reqList.length
        ? React.createElement("div", { className: "req-list" },
            reqList.map((p) => {
              const cat = CAT[p.cat];
              return React.createElement("div", { className: "req-card", key: p.id, onClick: () => onOpen(p.id) },
                React.createElement("div", { className: "stripe", style: { background: cat.color } }),
                React.createElement("div", { className: "req-body" },
                  React.createElement("h3", null, p.title.split(" — ")[0]),
                  React.createElement("div", { className: "req-sub" }, "led by " + p.lead.name + " · requested just now")
                ),
                React.createElement("div", { className: "req-status" },
                  React.createElement("span", { className: "pending" }, React.createElement(Icon, { name: "clock", size: 14, stroke: "currentColor" }), "Awaiting reply"))
              );
            }))
        : React.createElement(EmptyState, { icon: "send", title: "No requests out yet", body: "When you request to join a project, you'll track its status here.", cta: "Find a project to join", onCta: onBrowse });
    } else {
      body = mineList.length
        ? React.createElement("div", { className: "board" },
            mineList.map((p) => React.createElement(ProjectCard, { key: p.id, p, saved: saved.has(p.id), joined: joined.has(p.id), onOpen, onSave })))
        : React.createElement(EmptyState, { icon: "plus", pin: true, title: "Pin your first project", body: "Recruiting for a startup, class team, or hackathon crew? Post it and we'll match you with students across NYC.", cta: "Start a project", onCta: onStart });
    }

    return (
      React.createElement("div", { className: "matches" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Your ", React.createElement("em", null, "board")),
            React.createElement("p", { className: "sub" }, "Everything you've saved, requested, and started — your corner of Nested.")
          )
        ),
        React.createElement("div", { className: "match-tabs" },
          TABS.map((t) => (
            React.createElement("button", { key: t.id, className: "match-tab" + (tab === t.id ? " active" : ""), onClick: () => setTab(t.id) },
              React.createElement(Icon, { name: t.icon, size: 18 }), t.label,
              t.n > 0 && React.createElement("span", { className: "b" }, t.n))
          ))
        ),
        body
      )
    );
  }

  export { Matches };
  export default Matches;
