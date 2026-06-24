/* ============================================================
   NESTED NYC — Messages (inbox)
   The conversation list reached from the header chat icon. Read-only
   in S4: each row shows the peer, the last message, when it landed, and
   an unread count — opening a thread (and sending) is S5, so rows are
   static here. Presentational like notifications.jsx; NestedApp owns the
   data (messageService.getInbox) and enriches each row with the peer's
   name/avatar before passing them down as `conversations`.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, Skeleton } from './shared'
import { relativeTime } from './messageAdapter'

  // One conversation row — a real button (click or Enter/Space opens it).
  // `peerId` keys the row; `fromMe` prefixes the preview with "You: " so the
  // list reads like a chat client.
  function ConvRow({ c, onOpen }) {
    // Attachment-only last message has no body → show a "📎 Attachment" preview.
    const base = c.lastBody || (c.lastHasAttachment ? "📎 Attachment" : "");
    const preview = (c.lastFromMe && base) ? "You: " + base : base;
    const open = () => onOpen && onOpen(c);
    const label = "Conversation with " + (c.name || "student") + (c.unreadCount > 0 ? ", " + c.unreadCount + " unread" : "");
    return (
      React.createElement("div", {
        className: "msg-row" + (c.unreadCount > 0 ? " unread" : ""), onClick: open,
        role: "button", tabIndex: 0, "aria-label": label,
        onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
      },
        React.createElement(Av, { name: c.name, img: c.avatar, size: 46 }),
        React.createElement("div", { className: "msg-main" },
          React.createElement("b", null, c.name),
          React.createElement("span", { className: "msg-preview" }, preview)
        ),
        React.createElement("div", { className: "msg-meta" },
          React.createElement("span", { className: "msg-time" }, relativeTime(c.lastAt)),
          c.unreadCount > 0 && React.createElement("span", { className: "msg-unread", "aria-label": c.unreadCount + " unread" }, c.unreadCount)
        )
      )
    );
  }

  function Messages({ conversations = [], loading = false, error = null, onRetry, onOpenThread }) {
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
        React.createElement("p", null, "When you connect with someone, your conversations will show up here."));
    } else {
      body = React.createElement("div", { className: "msg-list" },
        conversations.map((c) => React.createElement(ConvRow, { key: c.peerId, c, onOpen: onOpenThread })));
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
