/* ============================================================
   NESTED NYC — Message thread (one 1:1 conversation)
   Reached from an inbox row or a connected profile's "Message".
   Presentational: NestedApp owns the data (getThread), the optimistic
   send (reconcile-by-id), mark-thread-read, pagination + retry handlers,
   and the live read-receipt signal; this renders the peer header, the
   chat bubbles (oldest→newest) grouped by day, a delivery-status line
   under the latest sent message, a "load earlier" control, and the
   composer. Each feature is kept localized so it can be edited/removed:
     • date dividers + status line + retry → dayKey/dayLabel/messageStatus
       (pure, in messageAdapter)
     • load-earlier → onLoadEarlier/hasMore/loadingEarlier props
     • attachments → the optional attachments[] on a message + the
       composer attach control (see ATTACHMENTS markers)
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, Skeleton } from './shared'
import { relativeTime, messageStatus, dayKey, dayLabel } from './messageAdapter'
import { MAX_MESSAGE_CHARS, MAX_ATTACH_COUNT } from '../services/messageService'
import { Attachments, AttachPicker } from './messageAttachments'

  const { useState, useRef, useEffect, useLayoutEffect } = React;

  const STATUS_LABEL = { sending: "Sending…", delivered: "Delivered", seen: "Seen" };

  // One chat bubble. fromMe → right + accent; else left + paper. A pending
  // (optimistic, unconfirmed) message is dimmed; a failed send turns red and
  // offers a retry. Attachments (if any) render above the text body.
  function Bubble({ m, onRetry }) {
    const side = m.fromMe ? " me" : " them";
    const cls = "bubble" + side + (m.pending ? " pending" : "") + (m.failed ? " failed" : "");
    return (
      React.createElement("div", { className: "bubble-row" + side },
        React.createElement("div", { className: cls },
          m.attachments && m.attachments.length
            ? React.createElement(Attachments, { items: m.attachments, fromMe: m.fromMe })   // ATTACHMENTS
            : null,
          m.body ? React.createElement("span", { className: "bubble-body" }, m.body) : null,
          React.createElement("span", { className: "bubble-time" }, relativeTime(m.createdAt)),
          m.failed && React.createElement("button", {
            className: "bubble-retry", onClick: () => onRetry && onRetry(m),
            title: "Retry sending", "aria-label": "Retry sending this message",
          }, React.createElement(Icon, { name: "refresh", size: 13 }), "Failed — tap to retry")
        )
      )
    );
  }

  // The composer owns its own draft text; it clears on send. Enter sends,
  // Shift+Enter inserts a newline. A send needs non-empty text OR an attachment.
  // Over-length is capped client-side (the server caps too). Attachments are
  // selected here and handed up via onSend(body, files).
  function Composer({ onSend, sending }) {
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);   // ATTACHMENTS: selected File objects (pre-upload)
    const [note, setNote] = useState("");      // ATTACHMENTS: "skipped …" rejection note
    const ready = !sending && (text.trim().length > 0 || files.length > 0);
    const near = text.length > MAX_MESSAGE_CHARS - 280;
    const send = () => {
      const body = text.trim();
      if (!body && !files.length) return;
      setText(""); setFiles([]); setNote("");
      onSend(body, files);
    };
    const onKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };
    return (
      React.createElement("div", { className: "composer-wrap" },
        (files.length || note) ? React.createElement(AttachPicker.Tray, { files, note, onRemove: (i) => setFiles(files.filter((_, j) => j !== i)) }) : null,   // ATTACHMENTS
        React.createElement("div", { className: "composer" },
          React.createElement(AttachPicker, { count: files.length, onPick: (picked, n) => { setFiles((f) => [...f, ...picked].slice(0, MAX_ATTACH_COUNT)); setNote(n || ""); } }),   // ATTACHMENTS
          React.createElement("textarea", {
            className: "composer-input", placeholder: "Write a message…", value: text, rows: 1,
            maxLength: MAX_MESSAGE_CHARS,
            onChange: (e) => setText(e.target.value), onKeyDown,
          }),
          near && React.createElement("span", { className: "composer-count" + (text.length >= MAX_MESSAGE_CHARS ? " at-max" : "") }, text.length + "/" + MAX_MESSAGE_CHARS),
          React.createElement("button", {
            className: "btn btn-primary composer-send", onClick: send, disabled: !ready, title: "Send", "aria-label": "Send", "aria-disabled": !ready,
          }, React.createElement(Icon, { name: "send", size: 17, stroke: "var(--paper)" }))
        )
      )
    );
  }

  // Build the scrollable timeline: a date divider wherever the calendar day
  // changes, each bubble, and a single delivery-status line under the LAST
  // outgoing message (iMessage-style). Pure-ish: derives everything from the
  // messages array + the helpers.
  function Timeline({ messages, onRetry }) {
    let lastMineIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].fromMe) { lastMineIdx = i; break; } }
    const out = [];
    let prevKey = null;
    messages.forEach((m, i) => {
      const k = dayKey(m.createdAt);
      if (k && k !== prevKey) {
        out.push(React.createElement("div", { className: "thread-day", key: "day-" + k + "-" + i },
          React.createElement("span", null, dayLabel(m.createdAt))));
        prevKey = k;
      }
      out.push(React.createElement(Bubble, { key: m.id, m, onRetry }));
      if (i === lastMineIdx) {
        const st = messageStatus(m);
        if (st && st !== "failed") {
          out.push(React.createElement("div", { className: "bubble-status", key: "status-" + m.id }, STATUS_LABEL[st]));
        }
      }
    });
    return out;
  }

  function MessageThread({ peer, messages = [], status = "loading", onSend, onBack, onOpenProfile,
                           isBlocked = false, onBlock, onUnblock, onDelete, onRetry, sending = false,
                           onLoadEarlier, hasMore = false, loadingEarlier = false }) {
    const scrollRef = useRef(null);
    const endRef = useRef(null);
    const anchorRef = useRef(null);                 // pre-prepend {height,top} for scroll anchoring
    const lastId = messages.length ? messages[messages.length - 1].id : null;

    // Auto-scroll to the newest message on initial load and whenever a NEW
    // message lands at the bottom (keyed on the last id) — NOT when older
    // messages are prepended (lastId is unchanged then).
    useEffect(() => {
      if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({ block: "end" });
    }, [lastId, status]);

    // When an older batch is prepended, keep the viewport pinned to what the
    // user was reading (restore scrollTop by the height the prepend added).
    useLayoutEffect(() => {
      if (anchorRef.current && scrollRef.current) {
        const el = scrollRef.current;
        el.scrollTop = anchorRef.current.top + (el.scrollHeight - anchorRef.current.height);
        anchorRef.current = null;
      }
    }, [messages]);

    const loadEarlier = () => {
      if (scrollRef.current) anchorRef.current = { height: scrollRef.current.scrollHeight, top: scrollRef.current.scrollTop };
      onLoadEarlier && onLoadEarlier();
    };

    // Conversation overflow menu (block/unblock/delete). Open state is local; it
    // closes on click-outside, Escape, a selection, or a peer switch.
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
          peer && (onBlock || onUnblock || onDelete) && React.createElement("div", { className: "thread-more", ref: moreRef },
            React.createElement("button", {
              className: "iconbtn", onClick: () => setMenuOpen((o) => !o), title: "Conversation options",
              "aria-label": "Conversation options", "aria-haspopup": "menu", "aria-expanded": menuOpen,
            }, React.createElement(Icon, { name: "ellipsis", size: 20 })),
            menuOpen && React.createElement("div", { className: "thread-menu", role: "menu" },
              (onBlock || onUnblock) && (isBlocked
                ? React.createElement("button", { className: "thread-menu-item", role: "menuitem", onClick: () => { setMenuOpen(false); onUnblock && onUnblock(); } },
                    React.createElement(Icon, { name: "block", size: 16 }), "Unblock" + (handle ? " @" + handle : ""))
                : React.createElement("button", { className: "thread-menu-item danger", role: "menuitem", onClick: () => { setMenuOpen(false); onBlock && onBlock(); } },
                    React.createElement(Icon, { name: "block", size: 16 }), "Block" + (handle ? " @" + handle : ""))),
              onDelete && React.createElement("button", { className: "thread-menu-item danger", role: "menuitem", onClick: () => { setMenuOpen(false); onDelete(); } },
                React.createElement(Icon, { name: "trash", size: 16 }), "Delete conversation"))
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

        status === "ready" && React.createElement("div", { className: "thread-scroll", ref: scrollRef },
          hasMore && React.createElement("div", { className: "thread-loadmore" },
            React.createElement("button", { className: "btn btn-ghost", onClick: loadEarlier, disabled: loadingEarlier },
              loadingEarlier ? "Loading…" : [React.createElement(Icon, { name: "arrowRight", size: 14, key: "i", style: { transform: "rotate(-90deg)" } }), "Load earlier messages"])),
          messages.length
            ? React.createElement(Timeline, { messages, onRetry })
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
          : React.createElement(Composer, { onSend, sending }))
      )
    );
  }

  export { MessageThread };
  export default MessageThread;
