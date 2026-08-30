/* ============================================================
   NESTED NYC — Header dropdown panels (desktop)
   The topbar bell and account chip open these popovers. They
   render inside .topbar-desk, so they're desktop-only by
   construction — mobile collapses the same actions into the
   account sheet in NestedApp. Open/close state, the click-outside
   dismiss, and the sign-out confirm are owned by NestedApp; these
   are presentational (return null when closed).
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI, joinDots } from './data'
import { Av } from './shared'
import { notificationText, groupActivity } from './notificationAdapter'
import { postTimeAgo } from './postAdapter'

  const { useState, useEffect, useRef } = React;

  // How many pending items the bell preview shows before "View all".
  const NOTIF_PREVIEW = 5;

  // Glanceable, *actionable* preview of the two notification types:
  // incoming connection requests (connect back) and requests to join a
  // project you lead (approve / decline). Both resolve in place — acting
  // calls the same async handler the full page uses, which updates app
  // state and drops the row from the source array. These are not a
  // read/unread feed, so there's deliberately no "mark all as read".
  function NotifPanel({ open, count = 0, incoming = [], projectRequests = [], activity = [], unreadCount = 0, loading = false,
    onApprove, onReject, onConnect, onOpenProfile, onOpenProject, onOpenActivity, onSeen, onViewAll, onClose }) {
    // Per-row in-flight set — disables a row's buttons (and dims it) while its
    // async action runs; on success the source array updates and the row leaves.
    const [acting, setActing] = useState(() => new Set());
    // Opening the panel = seeing the activity. Remember which rows were new
    // at that moment (they keep their dot while the panel is open), then
    // flip them read on the server.
    const newIds = useRef(new Set());
    useEffect(() => {
      if (!open) { newIds.current = new Set(); return; }
      activity.filter((a) => !a.read).forEach((a) => newIds.current.add(a.id));
      if (onSeen) onSeen();
    }, [open, unreadCount]);
    if (!open) return null;

    function run(key, fn) {
      if (acting.has(key)) return;
      setActing((s) => new Set(s).add(key));
      Promise.resolve(fn && fn()).finally(() => {
        setActing((s) => { const n = new Set(s); n.delete(key); return n; });
      });
    }

    const rows = [];
    incoming.forEach((p) => rows.push({ kind: "conn", key: "c" + p.id, p }));
    projectRequests.forEach((req) => rows.push({ kind: "join", key: "j" + req.id, req }));
    // Activity (likes / comments / mentions) after the actionable rows, new first.
    const isNew = (n) => n.ids.some((id) => newIds.current.has(id)) || !n.read;
    groupActivity(activity).sort((a, b) => (isNew(a) ? 0 : 1) - (isNew(b) ? 0 : 1)).forEach((n) => rows.push({ kind: "act", key: "a" + n.id, n, fresh: isNew(n) }));
    const shown = rows.slice(0, NOTIF_PREVIEW);

    let inner;
    if (loading) {
      inner = React.createElement("div", { className: "menu-empty" }, "Loading…");
    } else if (!rows.length) {
      inner = React.createElement("div", { className: "menu-empty" },
        React.createElement(Icon, { name: "bell", size: 26, stroke: "var(--ink-faint)" }),
        React.createElement("span", null, "You're all caught up")
      );
    } else {
      inner = React.createElement("div", { className: "menu-rows" },
        shown.map((r) => {
          const busy = acting.has(r.key);
          if (r.kind === "conn") {
            const p = r.p;
            const uniName = (UNI[p.uni] || {}).name;
            return React.createElement("div", { key: r.key, className: "notif-row" + (busy ? " busy" : "") },
              React.createElement("button", {
                className: "nr-main", role: "menuitem",
                onClick: () => { onClose && onClose(); onOpenProfile && onOpenProfile(p); },
              },
                React.createElement(Av, { name: p.name, img: p.avatar }),
                React.createElement("span", { className: "nr-txt" },
                  React.createElement("b", null, p.name),
                  React.createElement("small", null, joinDots(p.realName, uniName))
                )
              ),
              React.createElement("span", { className: "nr-actions" },
                React.createElement("button", {
                  className: "nr-ico connect", title: "Connect back", "aria-label": "Connect back", disabled: busy,
                  onClick: (e) => { e.stopPropagation(); run(r.key, () => onConnect && onConnect(p.id)); },
                }, React.createElement(Icon, { name: "heart", size: 16 }))
              )
            );
          }
          if (r.kind === "act") {
            const n = r.n;
            return React.createElement("div", { key: r.key, className: "notif-row act" + (r.fresh ? " unread" : "") },
              React.createElement("button", {
                className: "nr-main", role: "menuitem",
                onClick: () => { onClose && onClose(); onOpenActivity && onOpenActivity(n); },
              },
                React.createElement(Av, { name: n.actor.name, img: n.actor.avatar || null }),
                React.createElement("span", { className: "nr-txt" },
                  React.createElement("b", null, notificationText(n)),
                  React.createElement("small", null, (n.snippet ? n.snippet + " · " : "") + postTimeAgo(n.at))
                )
              )
            );
          }
          const req = r.req;
          const proj = req.project || {};
          const sub = (proj.title || "your project") + (req.role ? " · " + req.role : "");
          return React.createElement("div", { key: r.key, className: "notif-row" + (busy ? " busy" : "") },
            React.createElement("button", {
              className: "nr-main", role: "menuitem",
              onClick: () => { onClose && onClose(); if (proj.id) onOpenProject && onOpenProject(proj.id); },
            },
              React.createElement(Av, { name: req.name, img: req.image }),
              React.createElement("span", { className: "nr-txt" },
                React.createElement("b", null, req.name),
                React.createElement("small", null, sub)
              )
            ),
            React.createElement("span", { className: "nr-actions" },
              React.createElement("button", {
                className: "nr-ico approve", title: "Approve", "aria-label": "Approve", disabled: busy,
                onClick: (e) => { e.stopPropagation(); run(r.key, () => onApprove && onApprove(req.id)); },
              }, React.createElement(Icon, { name: "check", size: 16 })),
              React.createElement("button", {
                className: "nr-ico reject", title: "Decline", "aria-label": "Decline", disabled: busy,
                onClick: (e) => { e.stopPropagation(); run(r.key, () => onReject && onReject(req.id)); },
              }, React.createElement(Icon, { name: "x", size: 16 }))
            )
          );
        })
      );
    }

    return React.createElement("div", { className: "hdr-menu notif-menu", role: "menu" },
      React.createElement("div", { className: "menu-head" },
        React.createElement("span", null, "Notifications"),
        count > 0 && React.createElement("span", { className: "menu-count" }, count)
      ),
      inner,
      React.createElement("button", { className: "menu-foot", onClick: () => { onClose && onClose(); onViewAll && onViewAll(); } },
        "View all notifications",
        React.createElement(Icon, { name: "arrowRight", size: 15 })
      )
    );
  }

  // Account menu behind the topbar chip. View / edit profile + sign out;
  // settings + appearance rows slot in where marked once that system lands.
  // onSignOut opens NestedApp's confirm modal — it does not sign out directly.
  function AccountPanel({ open, profile, photoUrl, uniName, onViewProfile, onEditProfile, onViewSaved, onSignOut, onClose }) {
    if (!open || !profile) return null;
    const choose = (fn) => () => { onClose && onClose(); if (fn) fn(); };

    return React.createElement("div", { className: "hdr-menu acct-menu", role: "menu" },
      React.createElement("div", { className: "menu-id" },
        React.createElement(Av, { name: profile.username, img: photoUrl }),
        React.createElement("div", { className: "menu-id-txt" },
          React.createElement("b", null, "@" + profile.username),
          uniName && React.createElement("small", null, uniName)
        )
      ),
      React.createElement("div", { className: "menu-div" }),
      React.createElement("button", { className: "menu-item", role: "menuitem", onClick: choose(onViewProfile) },
        React.createElement(Icon, { name: "user", size: 18 }), "View profile"),
      React.createElement("button", { className: "menu-item", role: "menuitem", onClick: choose(onEditProfile) },
        React.createElement(Icon, { name: "pencil", size: 18 }), "Edit profile"),
      React.createElement("button", { className: "menu-item", role: "menuitem", onClick: choose(onViewSaved) },
        React.createElement(Icon, { name: "bookmark", size: 18 }), "Saved"),
      // Settings / appearance / notification-pref rows slot in here.
      React.createElement("div", { className: "menu-div" }),
      React.createElement("button", { className: "menu-item danger", role: "menuitem", onClick: choose(onSignOut) },
        React.createElement(Icon, { name: "external", size: 18 }), "Sign out")
    );
  }

  export { NotifPanel, AccountPanel };
