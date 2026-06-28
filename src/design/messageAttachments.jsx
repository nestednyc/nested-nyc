/* ============================================================
   NESTED NYC — DM attachments (UI module)
   Self-contained so attachments can be edited/removed as a unit:
     • <Attachments> renders a sent/received message's stored files
       (images inline, documents as a download chip) from signed URLs.
     • <AttachPicker> is the composer's "+" control (hidden file input,
       client-side size/type validation) and <AttachPicker.Tray> previews
       the picked-but-not-yet-sent files.
   Limits live in messageService (MAX_ATTACH_BYTES / ALLOWED_ATTACH_MIME /
   MAX_ATTACH_COUNT) so the composer, the service, and the bucket agree.
   Classes are prefixed `dm-att-*` / `att-*` — note the bubble list is
   `.dm-att-list` (NOT `.att-list`, which the event attendee sheet owns).
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { MAX_ATTACH_BYTES, MAX_ATTACH_COUNT, ALLOWED_ATTACH_MIME } from '../services/messageService'

  const { useRef, useEffect, useState } = React;

  const isImage = (mime) => typeof mime === 'string' && mime.startsWith('image/');

  function prettySize(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return Math.round(b / 1024) + " KB";
    return (b / (1024 * 1024)).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + " MB";
  }

  // A document (or an image that can't render) as a download chip. `unavailable`
  // covers a missing OR expired/failed signed URL — the row stays informative
  // (name + size) but isn't a broken <img> or a dead link.
  function DocChip({ a, unavailable }) {
    const dead = unavailable || !a.url;
    return React.createElement("a", {
      className: "att-doc", href: dead ? undefined : a.url, target: "_blank", rel: "noopener noreferrer",
      download: dead ? undefined : (a.name || true), title: dead ? (a.name || "file") : ("Download " + (a.name || "file")),
      "aria-disabled": dead ? true : undefined,
    },
      React.createElement(Icon, { name: "file", size: 20 }),
      React.createElement("span", { className: "att-doc-meta" },
        React.createElement("b", null, a.name || "file"),
        React.createElement("small", null, prettySize(a.size) + (dead ? " · unavailable" : ""))),
      dead ? null : React.createElement(Icon, { name: "download", size: 16 }));
  }

  // An inline image from a signed URL. If the URL is absent OR fails to load
  // (e.g. the 1h signed URL expired on a long-open thread), it degrades to the
  // same DocChip the doc branch uses instead of showing a broken image (#19).
  function AttImage({ a }) {
    const [failed, setFailed] = useState(false);
    if (!a.url || failed) return React.createElement(DocChip, { a, unavailable: true });
    return React.createElement("a", { className: "att-img", href: a.url, target: "_blank", rel: "noopener noreferrer", title: a.name },
      React.createElement("img", { src: a.url, alt: a.name || "image attachment", loading: "lazy", onError: () => setFailed(true) }));
  }

  // Stored attachments on a confirmed message. `items`: [{ url, mime, name, size }].
  function Attachments({ items = [], fromMe = false }) {
    if (!items.length) return null;
    return (
      React.createElement("div", { className: "dm-att-list" + (fromMe ? " me" : "") },
        items.map((a, i) => (
          isImage(a.mime)
            ? React.createElement(AttImage, { key: i, a })
            : React.createElement(DocChip, { key: i, a })
        ))
      )
    );
  }

  // Composer "+" control. Validates each picked file (count/size/type) and hands
  // the accepted File objects up via onPick(accepted, rejectedNote). Rejections
  // come back as a short human note the composer can surface in the tray.
  function AttachPicker({ onPick, count = 0 }) {
    const inputRef = useRef(null);
    const onChange = (e) => {
      const picked = Array.from(e.target.files || []);
      e.target.value = "";   // allow re-picking the same file
      if (!picked.length) return;
      const accepted = []; const rejects = [];
      for (const f of picked) {
        if (count + accepted.length >= MAX_ATTACH_COUNT) { rejects.push(f.name + " (max " + MAX_ATTACH_COUNT + " files)"); continue; }
        if (f.size > MAX_ATTACH_BYTES) { rejects.push(f.name + " (over 10 MB)"); continue; }
        if (f.type && !ALLOWED_ATTACH_MIME.includes(f.type)) { rejects.push(f.name + " (type not supported)"); continue; }
        accepted.push(f);
      }
      onPick(accepted, rejects.length ? "Skipped: " + rejects.join(", ") : "");
    };
    return (
      React.createElement(React.Fragment, null,
        React.createElement("button", {
          className: "iconbtn composer-attach", type: "button", title: "Attach a file",
          "aria-label": "Attach a file", onClick: () => inputRef.current && inputRef.current.click(),
        }, React.createElement(Icon, { name: "paperclip", size: 19 })),
        React.createElement("input", {
          ref: inputRef, type: "file", multiple: true, hidden: true,
          accept: ALLOWED_ATTACH_MIME.join(","), onChange,
        })
      )
    );
  }

  // One staged file. A browser-decodable image shows as a thumbnail tile (the
  // picture IS the label); a non-image OR an image the browser can't render
  // (HEIC, …) falls back to a labeled file chip + size — never a broken <img>.
  function StagedItem({ file, url, onRemove }) {
    const [failed, setFailed] = useState(false);
    const removeBtn = React.createElement("button", {
      className: "att-chip-x", type: "button", title: "Remove", "aria-label": "Remove " + file.name, onClick: onRemove,
    }, React.createElement(Icon, { name: "x", size: 13 }));
    if (url && !failed) {
      return React.createElement("div", { className: "att-thumb", title: file.name },
        React.createElement("img", { className: "att-thumb-img", src: url, alt: file.name, onError: () => setFailed(true) }),
        removeBtn);
    }
    return React.createElement("div", { className: "att-chip" },
      React.createElement(Icon, { name: "file", size: 18 }),
      React.createElement("span", { className: "att-chip-meta" },
        React.createElement("span", { className: "att-chip-name", title: file.name }, file.name),
        React.createElement("span", { className: "att-chip-size" }, prettySize(file.size))),
      removeBtn);
  }

  // Pre-send preview of the picked File objects with per-file remove + an
  // optional rejection note.
  AttachPicker.Tray = function Tray({ files = [], onRemove, note }) {
    const [urls, setUrls] = useState([]);
    useEffect(() => {
      const made = files.map((f) => (f.type && f.type.startsWith("image/")) ? URL.createObjectURL(f) : null);
      setUrls(made);
      return () => made.forEach((u) => u && URL.revokeObjectURL(u));
    }, [files]);
    return (
      React.createElement("div", { className: "att-tray" },
        files.map((f, i) => React.createElement(StagedItem, { key: i, file: f, url: urls[i], onRemove: () => onRemove && onRemove(i) })),
        note ? React.createElement("span", { className: "att-tray-note" }, note) : null
      )
    );
  };

  export { Attachments, AttachPicker, prettySize };
  export default Attachments;
