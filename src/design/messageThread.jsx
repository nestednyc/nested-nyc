/* ============================================================
   NESTED NYC — Message thread (one 1:1 conversation)
   Reached from an inbox row or a connected profile's "Message".
   Presentational: NestedApp owns the data (getThread), the optimistic
   send (reconcile-by-id), and mark-thread-read; this renders the peer
   header, the chat bubbles (oldest→newest), and the composer. Sending
   is connection-gated server-side, and the entry points only offer it
   to connections, so the composer is always live here.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, Skeleton } from './shared'
import { relativeTime } from './messageAdapter'

  const { useState, useRef, useEffect } = React;

  // One chat bubble. fromMe → right + accent; else left + paper. A pending
  // (optimistic, unconfirmed) message is dimmed until the server confirms.
  function Bubble({ m }) {
    const side = m.fromMe ? " me" : " them";
    return (
      React.createElement("div", { className: "bubble-row" + side },
        React.createElement("div", { className: "bubble" + side + (m.pending ? " pending" : "") },
          React.createElement("span", { className: "bubble-body" }, m.body),
          React.createElement("span", { className: "bubble-time" }, relativeTime(m.createdAt))
        )
      )
    );
  }

  // The composer owns its own draft text; it clears on send. Enter sends,
  // Shift+Enter inserts a newline. Empty/whitespace-only drafts can't send.
  function Composer({ onSend }) {
    const [text, setText] = useState("");
    const ready = text.trim().length > 0;
    const send = () => {
      const body = text.trim();
      if (!body) return;
      setText("");
      onSend(body);
    };
    const onKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };
    return (
      React.createElement("div", { className: "composer" },
        React.createElement("textarea", {
          className: "composer-input", placeholder: "Write a message…", value: text, rows: 1,
          onChange: (e) => setText(e.target.value), onKeyDown,
        }),
        React.createElement("button", {
          className: "btn btn-primary composer-send", onClick: send, disabled: !ready, title: "Send", "aria-label": "Send", "aria-disabled": !ready,
        }, React.createElement(Icon, { name: "send", size: 17, stroke: "var(--paper)" }))
      )
    );
  }

  function MessageThread({ peer, messages = [], status = "loading", onSend, onBack, onOpenProfile, isBlocked = false, onBlock, onUnblock }) {
    // Keep the newest message in view on load and whenever one is added.
    const endRef = useRef(null);
    useEffect(() => {
      if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({ block: "end" });
    }, [messages.length, status]);

    // Conversation overflow menu (block/unblock). Open state is local; it closes
    // on click-outside, Escape, a selection, or a peer switch.
    const [menuOpen, setMenuOpen] = useState(false);
    const moreRef = useRef(null);
    useEffect(() => { setMenuOpen(false); }, [peer && peer.id]);
    useEffect(() => {
      if (!menuOpen) return;
      const onDown = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMenuOpen(false); };
      const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    }, [menuOpen]);

    const name = (peer && peer.name) || "Conversation";
    const handle = peer && peer.handle;

    return (
      React.createElement("div", { className: "thread" },
        React.createElement("div", { className: "thread-head" },
          React.createElement("button", { className: "back", onClick: onBack, "aria-label": "Back to messages" },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Messages"),
          peer && React.createElement("button", { className: "thread-peer", onClick: onOpenProfile, title: "View profile", "aria-label": "View " + (handle ? "@" + handle : name) + "'s profile" },
            React.createElement(Av, { name, img: peer.avatar, size: 34 }),
            React.createElement("span", { className: "thread-peer-id" },
              React.createElement("b", null, name),
              handle && React.createElement("small", null, "@" + handle))
          ),
          peer && (onBlock || onUnblock) && React.createElement("div", { className: "thread-more", ref: moreRef },
            React.createElement("button", {
              className: "iconbtn", onClick: () => setMenuOpen((o) => !o), title: "Conversation options",
              "aria-label": "Conversation options", "aria-haspopup": "menu", "aria-expanded": menuOpen,
            }, React.createElement(Icon, { name: "ellipsis", size: 20 })),
            menuOpen && React.createElement("div", { className: "thread-menu", role: "menu" },
              isBlocked
                ? React.createElement("button", { className: "thread-menu-item", role: "menuitem", onClick: () => { setMenuOpen(false); onUnblock && onUnblock(); } },
                    React.createElement(Icon, { name: "block", size: 16 }), "Unblock" + (handle ? " @" + handle : ""))
                : React.createElement("button", { className: "thread-menu-item danger", role: "menuitem", onClick: () => { setMenuOpen(false); onBlock && onBlock(); } },
                    React.createElement(Icon, { name: "block", size: 16 }), "Block" + (handle ? " @" + handle : "")))
          )
        ),

        status === "loading" && React.createElement("div", { className: "thread-scroll" }, React.createElement(Skeleton, { count: 3 })),

        (status === "error" || status === "missing") && React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: status === "missing" ? "users" : "refresh", size: 42, stroke: "var(--accent)" })),
          React.createElement("h3", null, status === "missing" ? "Conversation unavailable" : "Couldn't load this conversation"),
          React.createElement("p", null, status === "missing"
            ? "This person may have changed their handle or left Nested."
            : "Something went wrong reaching Nested. Head back and try again."),
          React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 16, stroke: "var(--paper)" }), "Back to messages")),

        status === "ready" && React.createElement("div", { className: "thread-scroll" },
          messages.length
            ? messages.map((m) => React.createElement(Bubble, { key: m.id, m }))
            : React.createElement("div", { className: "thread-empty" },
                React.createElement(Icon, { name: "chat", size: 34, stroke: "var(--accent)" }),
                React.createElement("p", null, "No messages yet — say hi" + (handle ? " to @" + handle : "") + ".")),
          React.createElement("div", { ref: endRef })
        ),

        status === "ready" && (isBlocked
          ? React.createElement("div", { className: "composer composer-blocked" },
              React.createElement("span", { className: "composer-blocked-txt" },
                React.createElement(Icon, { name: "block", size: 16, stroke: "var(--ink-faint)" }),
                "You blocked" + (handle ? " @" + handle : " this person") + "."),
              React.createElement("button", { className: "btn btn-ghost", onClick: () => onUnblock && onUnblock() }, "Unblock"))
          : React.createElement(Composer, { onSend }))
      )
    );
  }

  export { MessageThread };
  export default MessageThread;
