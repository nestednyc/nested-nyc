/* ============================================================
   NESTED NYC — Message thread (one 1:1 conversation)
   Reached from an inbox row or a connected profile's "Message".
   Presentational: NestedApp owns the data (getThread), the optimistic
   send (reconcile-by-id), mark-thread-read, pagination + retry handlers,
   and the live read-receipt signal; this renders the peer header, the
   chat bubbles (oldest→newest) grouped by day AND by sender-run (Discord-
   style: consecutive messages from one side tuck together, timestamp on
   the last of a run), a delivery-status line under the latest sent
   message, a "load earlier" control, and the composer. Each feature is
   kept localized so it can be edited/removed:
     • date dividers + status line + retry → dayKey/dayLabel/messageStatus
       (pure, in messageAdapter)
     • load-earlier → onLoadEarlier/hasMore/loadingEarlier props
     • attachments → the optional attachments[] on a message + the
       composer attach control (see ATTACHMENTS markers)
   Scrolling note: the DOCUMENT is the scroll container (not .thread-scroll),
   so auto-scroll + load-earlier anchoring both measure document.scrollingElement.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, Skeleton } from './shared'
import { relativeTime, messageStatus, dayKey, dayLabel } from './messageAdapter'
import { MAX_MESSAGE_CHARS, MAX_ATTACH_COUNT } from '../services/messageService'
import { Attachments, AttachPicker } from './messageAttachments'

  const { useState, useRef, useEffect, useLayoutEffect } = React;

  const STATUS_LABEL = { sending: "Sending…", delivered: "Delivered", seen: "Seen" };
  const GROUP_GAP_MS = 5 * 60 * 1000;   // same-sender messages within 5 min group into one run

  // Re-render on a slow tick so relative timestamps ("just now" → "2m") stay
  // fresh while a thread/inbox stays open. 45s is invisible churn, accurate enough.
  function useSlowTick(ms = 45000) {
    const [, force] = useState(0);
    useEffect(() => { const t = setInterval(() => force((n) => n + 1), ms); return () => clearInterval(t); }, [ms]);
  }

  const scrollEl = () => document.scrollingElement || document.documentElement;
  const sameRun = (a, b) => !!a && !!b && a.fromMe === b.fromMe
    && !!dayKey(a.createdAt) && dayKey(a.createdAt) === dayKey(b.createdAt)
    && Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < GROUP_GAP_MS;

  // One chat bubble. fromMe → right + accent; else left + paper. A pending
  // (optimistic) message is dimmed; a failed send turns red and offers a retry.
  // Grouped continuation bubbles tuck closer (gstart/gend drive corner + spacing);
  // the time shows only on the last bubble of a run (or on a failed bubble).
  function Bubble({ m, onRetry, onDiscard, firstOfGroup, lastOfGroup }) {
    const side = m.fromMe ? " me" : " them";
    const cls = "bubble" + side + (m.pending ? " pending" : "") + (m.failed ? " failed" : "")
      + (firstOfGroup ? " gstart" : "") + (lastOfGroup ? " gend" : "");
    return (
      React.createElement("div", { className: "bubble-row" + side + (firstOfGroup ? " group-start" : "") },
        React.createElement("div", { className: cls },
          m.attachments && m.attachments.length
            ? React.createElement(Attachments, { items: m.attachments, fromMe: m.fromMe })   // ATTACHMENTS
            : null,
          m.body ? React.createElement("span", { className: "bubble-body" }, m.body) : null,
          (lastOfGroup && !m.failed) ? React.createElement("span", { className: "bubble-time" }, relativeTime(m.createdAt)) : null,
          m.failed && React.createElement("div", { className: "bubble-failed-actions" },
            React.createElement("span", { className: "bubble-failed-label" }, "Failed to send"),
            React.createElement("button", {
              className: "bubble-retry", onClick: () => onRetry && onRetry(m),
              title: "Retry sending", "aria-label": "Retry sending this message",
            }, React.createElement(Icon, { name: "refresh", size: 13 }), "Retry"),
            React.createElement("button", {
              className: "bubble-discard", onClick: () => onDiscard && onDiscard(m),
              title: "Remove this message", "aria-label": "Remove this failed message",
            }, React.createElement(Icon, { name: "x", size: 13 }), "Remove"))
        )
      )
    );
  }

  // The composer owns its own draft text; it clears on send. Enter sends,
  // Shift+Enter inserts a newline. A send needs non-empty text OR an attachment.
  // The textarea auto-grows with content up to the CSS max-height, then scrolls.
  function Composer({ onSend }) {
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);   // ATTACHMENTS: selected File objects (pre-upload)
    const [note, setNote] = useState("");      // ATTACHMENTS: "skipped …" rejection note
    const taRef = useRef(null);
    const ready = (text.trim().length > 0 || files.length > 0);
    const near = text.length > MAX_MESSAGE_CHARS - 280;
    // Auto-grow: reset to auto then snap to content height (CSS max-height caps it).
    useLayoutEffect(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    }, [text]);
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
            ref: taRef, className: "composer-input", placeholder: "Write a message…", value: text, rows: 1,
            maxLength: MAX_MESSAGE_CHARS, "aria-label": "Write a message",
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
  // changes, each bubble (tagged first/last-of-run for grouping), and a single
  // delivery-status line under the LAST outgoing message (iMessage-style).
  function Timeline({ messages, onRetry, onDiscard }) {
    let lastMineIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].fromMe) { lastMineIdx = i; break; } }
    const out = [];
    let prevKey = null;
    messages.forEach((m, i) => {
      const k = dayKey(m.createdAt);
      let dayBreak = false;
      if (k && k !== prevKey) {
        out.push(React.createElement("div", { className: "thread-day", key: "day-" + k + "-" + i },
          React.createElement("span", null, dayLabel(m.createdAt))));
        prevKey = k; dayBreak = true;
      }
      const firstOfGroup = dayBreak || !sameRun(messages[i - 1], m);
      const lastOfGroup = !sameRun(m, messages[i + 1]);
      out.push(React.createElement(Bubble, { key: m.id, m, onRetry, onDiscard, firstOfGroup, lastOfGroup }));
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
                           isBlocked = false, onBlock, onUnblock, onDelete, onRetry, onDiscard,
                           onLoadEarlier, hasMore = false, loadingEarlier = false }) {
    useSlowTick();
    const scrollRef = useRef(null);
    const endRef = useRef(null);
    const anchorRef = useRef(null);                 // pre-prepend {height,top} of the document scroller
    const initialRef = useRef(true);                // first auto-scroll-to-bottom per opened thread
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    const lastMine = messages.length ? messages[messages.length - 1].fromMe : false;

    // A fresh thread (peer switch) should snap to the newest message on first paint.
    useEffect(() => { initialRef.current = true; }, [peer && peer.id]);

    // Auto-scroll to the newest message ONLY when it makes sense: the initial load,
    // a message I just sent, or when I'm already near the bottom. If I'm scrolled
    // up reading history, an incoming message must NOT yank me down (#10).
    useEffect(() => {
      if (status !== "ready") return;
      const se = scrollEl();
      const nearBottom = (se.scrollHeight - se.scrollTop - se.clientHeight) < 200;
      if (initialRef.current || lastMine || nearBottom) {
        if (endRef.current && endRef.current.scrollIntoView) endRef.current.scrollIntoView({ block: "end" });
        initialRef.current = false;
      }
    }, [lastId, status]);

    // When an older batch is prepended, keep the viewport pinned to what the user
    // was reading by compensating for the height the prepend added. The document
    // (not .thread-scroll) is the scroller, so anchor on document.scrollingElement.
    useLayoutEffect(() => {
      if (anchorRef.current) {
        const se = scrollEl();
        se.scrollTop = anchorRef.current.top + (se.scrollHeight - anchorRef.current.height);
        anchorRef.current = null;
      }
    }, [messages]);

    const loadEarlier = () => {
      const se = scrollEl();
      anchorRef.current = { height: se.scrollHeight, top: se.scrollTop };
      onLoadEarlier && onLoadEarlier();
    };

    // Conversation overflow menu (block/unblock/delete). Open state is local; it
    // closes on click-outside, Escape, a selection, or a peer switch. On open we
    // move focus into the menu for keyboard users.
    const [menuOpen, setMenuOpen] = useState(false);
    const moreRef = useRef(null);
    const menuRef = useRef(null);
    useEffect(() => { setMenuOpen(false); }, [peer && peer.id]);
    useEffect(() => {
      if (!menuOpen) return;
      const first = menuRef.current && menuRef.current.querySelector(".thread-menu-item");
      if (first) first.focus();
      const onDown = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMenuOpen(false); };
      const onKey = (e) => { if (e.key === "Escape") { setMenuOpen(false); const b = moreRef.current && moreRef.current.querySelector(".iconbtn"); if (b) b.focus(); } };
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
            menuOpen && React.createElement("div", { className: "thread-menu", role: "menu", ref: menuRef },
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

        status === "ready" && React.createElement("div", {
            className: "thread-scroll", ref: scrollRef,
            role: "log", "aria-live": "polite", "aria-relevant": "additions", "aria-label": "Messages with " + (handle ? "@" + handle : name),
          },
          hasMore && React.createElement("div", { className: "thread-loadmore" },
            React.createElement("button", { className: "btn btn-ghost", onClick: loadEarlier, disabled: loadingEarlier },
              loadingEarlier ? "Loading…" : [React.createElement(Icon, { name: "arrowRight", size: 14, key: "i", style: { transform: "rotate(-90deg)" } }), "Load earlier messages"])),
          messages.length
            ? React.createElement(Timeline, { messages, onRetry, onDiscard })
            : React.createElement("div", { className: "thread-empty" },
                React.createElement(Icon, { name: "chat", size: 34, stroke: "var(--accent)" }),
                React.createElement("p", null, "No messages yet — say hi" + (handle ? " to @" + handle : "") + ".")),
          React.createElement("div", { ref: endRef, style: { scrollMarginBottom: "104px" } })   // keep the newest bubble + status clear of the sticky composer on auto-scroll
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
