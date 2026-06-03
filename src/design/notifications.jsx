/* ============================================================
   NESTED NYC — Notifications (inbox)
   Two stacked sections: incoming connection requests + requests
   to join your projects. Reached via the header bell. Reuses the
   People conn-card and the detail-page team-row patterns — no new
   visual language.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ROLE, UNI } from './data'
import { Av, Skeleton } from './shared'
import { ContactLinks } from './people'

  // One incoming connection — moved verbatim from People's old "incoming" tab.
  function ConnRow({ p, mutual, onConnect, onContact }) {
    return (
      React.createElement("div", { className: "conn-card" },
        React.createElement("div", { className: "conn-head" },
          React.createElement(Av, { name: p.name, color: (ROLE[p.role] || {}).color, img: p.avatar }),
          React.createElement("div", { className: "who" },
            React.createElement("b", null, p.name),
            React.createElement("small", null, "@" + p.handle + " · " + ((UNI[p.uni] || {}).name || ""))),
          React.createElement("button", {
            className: "btn " + (mutual ? "btn-primary done" : "btn-primary"),
            style: { marginLeft: "auto", padding: "7px 13px", fontSize: 13 },
            onClick: () => { if (!mutual) onConnect && onConnect(p.id); },
          }, mutual
            ? [React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)", key: "i" }), "Mutual"]
            : [React.createElement(Icon, { name: "heart", size: 15, stroke: "var(--paper)", key: "i" }), "Connect back"])
        ),
        React.createElement(ContactLinks, { person: p, onContact })
      )
    );
  }

  // One join request — mirrors detail.jsx's team-row with project context added.
  function RequestRow({ req, onApprove, onReject, onOpenProject }) {
    const proj = req.project || {};
    return (
      React.createElement("div", { className: "team-row", style: { alignItems: "flex-start" } },
        React.createElement(Av, { name: req.name, img: req.image }),
        React.createElement("span", { className: "t-who", style: { flex: 1 } },
          React.createElement("b", null, req.name),
          React.createElement("small", null,
            "wants to join ",
            proj.title
              ? React.createElement("a", {
                  onClick: (e) => { e.preventDefault(); onOpenProject && onOpenProject(proj.id); },
                  style: { cursor: "pointer", color: "var(--accent-ink)", fontWeight: 600 },
                }, proj.title)
              : "your project",
            (req.message || req.school) ? " · " + (req.message || req.school) : "")
        ),
        React.createElement("span", { style: { display: "flex", gap: 6 } },
          React.createElement("button", { className: "btn btn-primary btn-sm", title: "Approve", onClick: () => onApprove && onApprove(req.id) },
            React.createElement(Icon, { name: "check", size: 14, stroke: "var(--paper)" })),
          React.createElement("button", { className: "btn btn-ghost btn-sm", title: "Decline", onClick: () => onReject && onReject(req.id) },
            React.createElement(Icon, { name: "x", size: 14 }))
        )
      )
    );
  }

  function Notifications({ incoming = [], connected = [], projectRequests = [], onConnect, onApprove, onReject, onContact, onOpenProject, loading = false, error = null, onRetry }) {
    const connSet = new Set(connected);

    let body;
    if (loading) {
      body = React.createElement(Skeleton, { count: 4 });
    } else if (error) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "refresh", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "Couldn't load notifications"),
        React.createElement("p", null, "Something went wrong reaching Nested. Check your connection and try again."),
        React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onRetry },
          React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Try again"));
    } else if (!incoming.length && !projectRequests.length) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "bell", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "You're all caught up"),
        React.createElement("p", null, "New connection requests and requests to join your projects will show up here."));
    } else {
      body = React.createElement("div", null,
        incoming.length > 0 && React.createElement("div", { className: "notif-sec" },
          React.createElement("div", { className: "sec-h" }, "Connection requests · " + incoming.length),
          React.createElement("div", { className: "conn-grid" },
            incoming.map((p) => React.createElement(ConnRow, { key: p.id, p, mutual: connSet.has(p.id), onConnect, onContact })))
        ),
        projectRequests.length > 0 && React.createElement("div", { className: "notif-sec" },
          React.createElement("div", { className: "sec-h" }, "Requests to join · " + projectRequests.length),
          React.createElement("div", { className: "rail-card" },
            React.createElement("div", { className: "team-pile" },
              projectRequests.map((req) => React.createElement(RequestRow, { key: req.id, req, onApprove, onReject, onOpenProject })))))
      );
    }

    return (
      React.createElement("div", { className: "people" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Your ", React.createElement("em", null, "notifications")),
            React.createElement("p", { className: "sub" }, "People who connected with you, and students asking to join your projects.")
          )
        ),
        body
      )
    );
  }

  export { Notifications };
  export default Notifications;
