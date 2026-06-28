/* ============================================================
   NESTED NYC — Messages (inbox)
   The conversation list reached from the header chat icon. Each row
   shows the peer, the last message, when it landed, and an unread
   count; clicking a row opens the thread. The trailing ⋯ is the per-
   conversation menu (block / delete) — relocated here from the open
   thread so a conversation can be managed without entering it.
   Presentational like notifications.jsx; NestedApp owns the data
   (messageService.getInbox) and the block/delete handlers.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, Skeleton } from './shared'
import { relativeTime } from './messageAdapter'

  const { useState, useRef, useEffect } = React;

  // One conversation row — a real button (click or Enter/Space opens it).
  // `peerId` keys the row; `fromMe` prefixes the preview with "You: " so the
  // list reads like a chat client. The trailing ⋯ opens a per-conversation
  // menu (block / delete); its clicks stopPropagation so they don't also open
  // the thread, and the row's keydown only opens when the row ITSELF is focused
  // (not a child control). Menu closes on click-outside / Escape.
  function ConvRow({ c, onOpen, active = false, isBlocked = false, onBlock, onUnblock, onDelete }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const moreRef = useRef(null);
    useEffect(() => {
      if (!menuOpen) return;
      const onDown = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMenuOpen(false); };
      const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    }, [menuOpen]);

    // Attachment-only last message has no body → show a "📎 Attachment" preview.
    const base = c.lastBody || (c.lastHasAttachment ? "📎 Attachment" : "");
    const preview = (c.lastFromMe && base) ? "You: " + base : base;
    const open = () => onOpen && onOpen(c);
    const label = "Conversation with " + (c.name || "student") + (c.unreadCount > 0 ? ", " + c.unreadCount + " unread" : "");
    const peer = { id: c.peerId, handle: c.handle, name: c.name, avatar: c.avatar };
    const hasMenu = !!(onBlock || onUnblock || onDelete);
    // A menu choice: swallow the click (so the row doesn't open), close, then act.
    const choose = (fn) => (e) => { e.stopPropagation(); setMenuOpen(false); fn && fn(peer); };

    return (
      React.createElement("div", {
        className: "msg-row" + (c.unreadCount > 0 ? " unread" : "") + (active ? " active" : ""), onClick: open,
        role: "button", tabIndex: 0, "aria-label": label,
        onKeyDown: (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); open(); } },
      },
        React.createElement(Av, { name: c.name, img: c.avatar, size: 46 }),
        React.createElement("div", { className: "msg-main" },
          React.createElement("b", null, c.name),
          React.createElement("span", { className: "msg-preview" }, preview)
        ),
        React.createElement("div", { className: "msg-meta" },
          React.createElement("span", { className: "msg-time" }, relativeTime(c.lastAt)),
          c.unreadCount > 0 && React.createElement("span", { className: "msg-unread", "aria-label": c.unreadCount + " unread" }, c.unreadCount)
        ),
        hasMenu && React.createElement("div", { className: "msg-more", ref: moreRef },
          React.createElement("button", {
            className: "iconbtn", onClick: (e) => { e.stopPropagation(); setMenuOpen((o) => !o); },
            title: "Conversation options", "aria-label": "Conversation options",
            "aria-haspopup": "menu", "aria-expanded": menuOpen,
          }, React.createElement(Icon, { name: "ellipsis", size: 20 })),
          menuOpen && React.createElement("div", { className: "thread-menu", role: "menu", onClick: (e) => e.stopPropagation() },
            (onBlock || onUnblock) && (isBlocked
              ? React.createElement("button", { className: "thread-menu-item", role: "menuitem", onClick: choose(onUnblock) },
                  React.createElement(Icon, { name: "block", size: 16 }), "Unblock" + (peer.handle ? " @" + peer.handle : ""))
              : React.createElement("button", { className: "thread-menu-item danger", role: "menuitem", onClick: choose(onBlock) },
                  React.createElement(Icon, { name: "block", size: 16 }), "Block" + (peer.handle ? " @" + peer.handle : ""))),
            onDelete && React.createElement("button", { className: "thread-menu-item danger", role: "menuitem", onClick: choose(onDelete) },
              React.createElement(Icon, { name: "trash", size: 16 }), "Delete conversation"))
        )
      )
    );
  }

  function Messages({ conversations = [], loading = false, error = null, onRetry, onOpenThread,
                      activeHandle, blocked, onBlock, onUnblock, onDelete }) {
    let body;
    if (loading) {
      body = React.createElement(Skeleton, { count: 5 });
    } else if (error) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "refresh", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "Couldn't load messages"),
        React.createElement("p", null, "Something went wrong reaching Nested. Check your connection and try again."),
        React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onRetry },
          React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Try again"));
    } else if (!conversations.length) {
      body = React.createElement("div", { className: "match-empty fade-up" },
        React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "chat", size: 42, stroke: "var(--accent)" })),
        React.createElement("h3", null, "No messages yet"),
        React.createElement("p", null, "Open someone's profile and hit Message to start a conversation — it'll show up here."));
    } else {
      body = React.createElement("div", { className: "msg-list" },
        conversations.map((c) => React.createElement(ConvRow, {
          key: c.peerId, c, onOpen: onOpenThread,
          active: !!(activeHandle && c.handle && c.handle.toLowerCase() === String(activeHandle).toLowerCase()),
          isBlocked: !!(blocked && blocked.has(c.peerId)),
          onBlock, onUnblock, onDelete,
        })));
    }

    return (
      React.createElement("div", { className: "people" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Your ", React.createElement("em", null, "messages")),
            React.createElement("p", { className: "sub" }, "Your conversations with other students, newest first.")
          )
        ),
        body
      )
    );
  }

  export { Messages };
  export default Messages;
