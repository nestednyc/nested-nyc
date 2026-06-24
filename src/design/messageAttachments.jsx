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

  // Stored attachments on a confirmed message. `items`: [{ url, mime, name, size }].
  function Attachments({ items = [], fromMe = false }) {
    if (!items.length) return null;
    return (
      React.createElement("div", { className: "att-list" + (fromMe ? " me" : "") },
        items.map((a, i) => (
          isImage(a.mime) && a.url
            ? React.createElement("a", { key: i, className: "att-img", href: a.url, target: "_blank", rel: "noopener noreferrer", title: a.name },
                React.createElement("img", { src: a.url, alt: a.name || "image attachment", loading: "lazy" }))
            : React.createElement("a", {
                key: i, className: "att-doc", href: a.url || undefined, target: "_blank", rel: "noopener noreferrer",
                download: a.name || true, title: a.url ? "Download " + (a.name || "file") : (a.name || "file"),
                "aria-disabled": a.url ? undefined : true,
              },
                React.createElement(Icon, { name: "file", size: 20 }),
                React.createElement("span", { className: "att-doc-meta" },
                  React.createElement("b", null, a.name || "file"),
                  React.createElement("small", null, prettySize(a.size) + (a.url ? "" : " · unavailable"))),
                a.url && React.createElement(Icon, { name: "download", size: 16 }))
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

  // Pre-send preview of the picked File objects (image thumbnails / doc chips)
  // with per-file remove + an optional rejection note.
  AttachPicker.Tray = function Tray({ files = [], onRemove, note }) {
    const [urls, setUrls] = useState([]);
    useEffect(() => {
      const made = files.map((f) => (f.type && f.type.startsWith("image/")) ? URL.createObjectURL(f) : null);
      setUrls(made);
      return () => made.forEach((u) => u && URL.revokeObjectURL(u));
    }, [files]);
    return (
      React.createElement("div", { className: "att-tray" },
        files.map((f, i) => (
          React.createElement("div", { className: "att-chip", key: i },
            urls[i]
              ? React.createElement("img", { className: "att-chip-thumb", src: urls[i], alt: f.name })
              : React.createElement(Icon, { name: "file", size: 16 }),
            React.createElement("span", { className: "att-chip-name", title: f.name }, f.name),
            React.createElement("button", {
              className: "att-chip-x", type: "button", title: "Remove", "aria-label": "Remove " + f.name,
              onClick: () => onRemove && onRemove(i),
            }, React.createElement(Icon, { name: "x", size: 13 }))
          )
        )),
        note ? React.createElement("span", { className: "att-tray-note" }, note) : null
      )
    );
  };

  export { Attachments, AttachPicker, prettySize };
  export default Attachments;
