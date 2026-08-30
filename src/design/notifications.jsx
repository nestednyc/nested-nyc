/* ============================================================
   NESTED NYC — Notifications (inbox)
   Two stacked sections: incoming connection requests + requests
   to join your projects. Reached via the header bell. Reuses the
   conn-card (now only rendered here) and the detail-page team-row
   patterns — no new visual language.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI, joinDots } from './data'
import { Av, Skeleton } from './shared'
import { ContactLinks } from './people'
import { notificationText, groupActivity } from './notificationAdapter'
import { postTimeAgo } from './postAdapter'

  const { useEffect, useState } = React;

  // One activity item — a like, a comment, a mention. Click → the note.
  function ActivityRow({ n, isNew, onOpen }) {
    return (
      React.createElement("button", { type: "button", className: "act-row" + (isNew ? "" : " read"), onClick: () => onOpen && onOpen(n) },
        React.createElement("span", { className: "act-dot" }),
        React.createElement(Av, { name: n.actor.name, img: n.actor.avatar || null }),
        React.createElement("span", { className: "act-txt" },
          React.createElement("b", null, notificationText(n)),
          n.snippet && React.createElement("small", null, n.kind === "post_comment" || n.kind === "mention" ? "“" + n.snippet + "”" : n.snippet)),
        React.createElement("span", { className: "act-time" }, postTimeAgo(n.at))
      )
    );
  }

  // One incoming connection — moved verbatim from People's old "incoming" tab.
  // The identity block (avatar + name) opens the person's full ProfileModal so
  // you can see their skills, what they're building, and ALL their links — not
  // just whatever fit on the card.
  function ConnRow({ p, mutual, onConnect, onOpenProfile }) {
    const open = onOpenProfile ? () => onOpenProfile(p) : undefined;
    return (
      React.createElement("div", { className: "conn-card" },
        React.createElement("div", { className: "conn-head" },
          React.createElement("div", {
            className: "conn-id", onClick: open,
            style: open ? { cursor: "pointer" } : undefined,
            title: open ? "View full profile" : undefined,
          },
            React.createElement(Av, { name: p.name, img: p.avatar }),
            React.createElement("div", { className: "who" },
              React.createElement("b", null, p.name),
              React.createElement("small", null, joinDots(p.realName, (UNI[p.uni] || {}).name)))),
          React.createElement("button", {
            className: "btn " + (mutual ? "btn-primary done" : "btn-primary"),
            style: { marginLeft: "auto", padding: "7px 13px", fontSize: 13 },
            onClick: () => { if (!mutual) onConnect && onConnect(p.id); },
          }, mutual
            ? [React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)", key: "i" }), "Mutual"]
            : [React.createElement(Icon, { name: "heart", size: 15, stroke: "var(--paper)", key: "i" }), "Connect back"])
        ),
        React.createElement(ContactLinks, { person: p })
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
          (req.realName && req.realName !== req.name)
            ? React.createElement("small", { style: { display: "block", color: "var(--ink-soft)" } }, req.realName)
            : null,
          React.createElement("small", null,
            "wants to join ",
            proj.title
              ? React.createElement("a", {
                  onClick: (e) => { e.preventDefault(); onOpenProject && onOpenProject(proj.id); },
                  style: { cursor: "pointer", color: "var(--accent-ink)", fontWeight: 600 },
                }, proj.title)
              : "your project",
            req.role ? [" for ", React.createElement("b", { key: "role", style: { color: "var(--accent-ink)" } }, req.role)] : null,
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

  function Notifications({
    incoming = [], connected = [], projectRequests = [], onConnect, onApprove, onReject, onOpenProject, onOpenProfile,
    activity = [], activityLoading = false, unreadActivity = 0, onMarkAllRead, onOpenActivity,
    loading = false, error = null, onRetry,
  }) {
    const connSet = new Set(connected);
    // Opening the page reads the activity: remember which rows were new when
    // it first rendered (they keep their dot for this visit), then flip them
    // read on the server. Waits for the first load so a cold visit works too.
    // Rows that arrive live while the page is open join the set and get read too.
    const [newIds, setNewIds] = useState(null);
    useEffect(() => {
      if (activityLoading) return;
      const fresh = activity.filter((a) => !a.read).map((a) => a.id);
      if (!fresh.length) { if (newIds === null && activity.length) setNewIds(new Set()); return; }
      setNewIds((prev) => new Set([...(prev || []), ...fresh]));
      if (onMarkAllRead) onMarkAllRead();
    }, [activityLoading, activity.length, unreadActivity]);
    const grouped = groupActivity(activity);
    const newCount = newIds ? grouped.filter((g) => g.ids.some((id) => newIds.has(id))).length : 0;

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
    } else if (!incoming.length && !projectRequests.length && !activity.length && !activityLoading) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "bell", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "You're all caught up"),
        React.createElement("p", null, "Connection requests, requests to join your projects, and likes, comments and mentions on the board all land here."));
    } else {
      body = React.createElement("div", null,
        incoming.length > 0 && React.createElement("div", { className: "notif-sec" },
          React.createElement("div", { className: "sec-h" }, "Connection requests · " + incoming.length),
          React.createElement("div", { className: "conn-grid" },
            incoming.map((p) => React.createElement(ConnRow, { key: p.id, p, mutual: connSet.has(p.id), onConnect, onOpenProfile })))
        ),
        projectRequests.length > 0 && React.createElement("div", { className: "notif-sec" },
          React.createElement("div", { className: "sec-h" }, "Requests to join · " + projectRequests.length),
          React.createElement("div", { className: "rail-card" },
            React.createElement("div", { className: "team-pile" },
              projectRequests.map((req) => React.createElement(RequestRow, { key: req.id, req, onApprove, onReject, onOpenProject }))))),
        (activity.length > 0 || activityLoading) && React.createElement("div", { className: "notif-sec" },
          React.createElement("div", { className: "sec-h" }, "Activity" + (newCount ? " · " + newCount + " new" : "")),
          React.createElement("div", { className: "rail-card act-list" },
            activityLoading && !activity.length && React.createElement("div", { className: "ev-skel line", style: { width: "60%" } }),
            grouped.map((n) => React.createElement(ActivityRow, { key: n.id, n, isNew: !!(newIds && n.ids.some((id) => newIds.has(id))), onOpen: onOpenActivity }))))
      );
    }

    return (
      React.createElement("div", { className: "people" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Your ", React.createElement("em", null, "notifications")),
            React.createElement("p", { className: "sub" }, "People who connected with you, students asking to join your projects, and what's happening to your notes on the board.")
          )
        ),
        body
      )
    );
  }

  export { Notifications };
  export default Notifications;
