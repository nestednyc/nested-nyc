/* ============================================================
   NESTED NYC — shared UI atoms
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { avColor, initials, UNI, ORG_TYPES } from './data'

  const { useState, useRef } = React;

  function Av({ name, color, size, img, label }) {
    const style = { background: color || avColor(name) };
    if (size) { style.width = size; style.height = size; style.fontSize = Math.round(size * 0.36); }
    if (img) {
      return React.createElement("span", { className: "av", style },
        React.createElement("img", {
          src: img, alt: name, loading: "lazy",
          style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" },
        }));
    }
    return React.createElement("span", { className: "av", style }, label || initials(name));
  }

  function Facepile({ names, extra }) {
    return (
      React.createElement("div", { className: "facepile" },
        names.map((n, i) => React.createElement(Av, {
          key: i,
          name: typeof n === "string" ? n : (n && n.name),
          img: typeof n === "string" ? null : (n && n.img),
        })),
        extra > 0 && React.createElement("span", {
          className: "av", style: { background: "var(--ink-soft)" },
        }, "+" + extra)
      )
    );
  }

  function CatTag({ cat, large }) {
    return (
      React.createElement("span", {
        className: "cat-tag",
        style: { background: cat.wash, color: cat.ink, fontSize: large ? 12.5 : undefined, padding: large ? "6px 13px" : undefined },
      },
        React.createElement(Icon, { name: cat.icon, size: large ? 15 : 13, width: 2, stroke: cat.color }),
        cat.label
      )
    );
  }

  // push pin svg
  function Pin({ className }) {
    return (
      React.createElement("svg", { className: className || "pin", viewBox: "0 0 30 30" },
        React.createElement("circle", { cx: 15, cy: 12, r: 9, fill: "var(--accent)" }),
        React.createElement("circle", { cx: 15, cy: 12, r: 9, fill: "none", stroke: "var(--accent-ink)", strokeWidth: 1 }),
        React.createElement("ellipse", { cx: 12, cy: 9, rx: 3, ry: 2, fill: "oklch(1 0 0 / 0.45)" }),
        React.createElement("path", { d: "M15 21v7", stroke: "var(--accent-ink)", strokeWidth: 2, strokeLinecap: "round" })
      )
    );
  }

  // rubber stamp ".edu verified" — third line defaults to STUDENT, but org
  // pages pass label="ORG" so it reads ".EDU / VERIFIED / ORG".
  function Stamp({ size = 120, className, style, label = "STUDENT" }) {
    return (
      React.createElement("svg", { className, style, width: size, height: size, viewBox: "0 0 120 120" },
        React.createElement("g", { fill: "none", stroke: "var(--accent)", strokeWidth: 2.5 },
          React.createElement("circle", { cx: 60, cy: 60, r: 54, strokeDasharray: "3 4", opacity: 0.85 }),
          React.createElement("circle", { cx: 60, cy: 60, r: 44 })
        ),
        React.createElement("text", { x: 60, y: 50, textAnchor: "middle", fontFamily: "Spline Sans Mono, monospace", fontSize: 14, fontWeight: 600, fill: "var(--accent)", letterSpacing: 1 }, ".EDU"),
        React.createElement("text", { x: 60, y: 68, textAnchor: "middle", fontFamily: "Spline Sans Mono, monospace", fontSize: 9, fill: "var(--accent)", letterSpacing: 1 }, "VERIFIED"),
        React.createElement("text", { x: 60, y: 82, textAnchor: "middle", fontFamily: "Spline Sans Mono, monospace", fontSize: 7, fill: "var(--accent)", letterSpacing: 1.5 }, label)
      )
    );
  }

  function Toasts({ items }) {
    if (!items.length) return null;
    return (
      React.createElement("div", { className: "toast-wrap" },
        items.map((t) => (
          React.createElement("div", { className: "toast", key: t.id },
            React.createElement(Icon, { name: t.icon || "check", size: 18, stroke: "var(--c-hack)" }),
            t.text
          )
        ))
      )
    );
  }

  // University logo — image on a clean tile, falling back to the colored
  // initial seal if the URL is missing or fails to load. Handles mixed logo
  // shapes (square seals + wide wordmarks) via object-fit: contain.
  function UniLogo({ uni, size = 40, radius = "28%" }) {
    const [failed, setFailed] = useState(false);
    if (!uni) return null;
    const base = { width: size, height: size, borderRadius: radius };
    if (failed || !uni.logo) {
      return React.createElement("span", {
        className: "uni-logo fallback",
        style: { ...base, background: uni.color || "var(--ink-soft)", fontSize: Math.round(size * 0.42) },
      }, (uni.name || "?")[0]);
    }
    return React.createElement("span", { className: "uni-logo", style: base },
      React.createElement("img", { src: uni.logo, alt: uni.name + " logo", loading: "lazy", onError: () => setFailed(true) })
    );
  }

  // Compact org "flyer" — a taped paper card (cork-board vocabulary). The single
  // source for the org's small representation: the signup-form live preview AND
  // the dashboard's "your public flyer" echo both render this, so they can't
  // drift. Glyph is the campus mark (UniLogo) when the org's `uni` slug resolves,
  // else the initials avatar. Foot shows the verified/pending state.
  function OrgMini({ name, type, uni, bio, verified }) {
    const uniObj = uni && UNI[uni] ? UNI[uni] : null;
    const typeLabel = type ? ((ORG_TYPES.find((t) => t.id === type) || {}).label || "Organization") : "Organization";
    const sub = [typeLabel, uniObj && uniObj.name].filter(Boolean).join(" · ");
    const display = name && name.trim() ? name.trim() : "Your organization";
    return (
      React.createElement("article", { className: "org-mini grain", style: { "--rot": "0deg" } },
        React.createElement("div", { className: "org-mini-head" },
          uniObj
            ? React.createElement(UniLogo, { uni: uniObj, size: 46, radius: "26%" })
            : React.createElement(Av, { name: display, size: 46 }),
          React.createElement("div", { className: "org-mini-id" },
            React.createElement("b", null, display),
            React.createElement("small", null, sub)
          )
        ),
        React.createElement("p", { className: "org-mini-bio" }, (bio || "").trim() || "A one-line description of who you are and what you host."),
        React.createElement("div", { className: "org-mini-foot" },
          verified
            ? React.createElement("span", { className: "owner-chip" }, React.createElement(Icon, { name: "check", size: 12, stroke: "var(--accent)", width: 2.4 }), "Verified")
            : React.createElement("span", { className: "pending-chip" }, React.createElement(Icon, { name: "clock", size: 12, stroke: "currentColor" }), "Pending .edu review")
        )
      )
    );
  }

  // Split a YYYY-MM-DD string into the calendar-card pieces the cork-board
  // shows on events (postage stamp on the detail page, date block on cards,
  // event rows on org pages). Single source of truth — any new event UI
  // should call this rather than re-parsing the date inline.
  // Returns sentinel "—" values for missing/invalid input so callers can
  // render unconditionally without null guards.
  function formatEventDate(iso) {
    if (!iso) return { mon: "—", day: "—", weekday: "", dateLabel: "" };
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return { mon: "—", day: "—", weekday: "", dateLabel: "" };
    return {
      mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      day: String(d.getDate()).padStart(2, "0"),
      weekday: d.toLocaleString("en-US", { weekday: "long" }),
      dateLabel: d.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    };
  }

  // Loading placeholder — a responsive grid of shimmer cards (reuses the
  // .ev-skel shimmer from styles.css). Shown by the data-driven surfaces
  // (People, Discover, Saved) while their Supabase fetch is in flight.
  function Skeleton({ count = 6 }) {
    return (
      React.createElement("div", { className: "skel-grid" },
        Array.from({ length: count }).map((_, i) =>
          React.createElement("div", { className: "ev-skel skel-card", key: i })))
    );
  }

  // Confirm dialog in the flyer voice: scrim > paper modal > cat-bar accent >
  // close > title/body > ghost Cancel + primary CTA. `accent` is the cat-bar
  // color — callers pass `p.flyerColor || CAT[p.cat].color` so this file stays
  // free of the taxonomy. `danger` paints the CTA in the alert red. `body`
  // takes a node, so callers can bold names inline.
  function ConfirmModal({ accent, title, body, ctaLabel, ctaIcon, danger, onCancel, onConfirm }) {
    return (
      React.createElement("div", { className: "scrim", onClick: onCancel },
        React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation(), style: { maxWidth: 440 } },
          React.createElement("div", { className: "cat-bar", style: { background: accent } }),
          React.createElement("button", { className: "modal-close", onClick: onCancel },
            React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("h2", null, title),
            React.createElement("p", null, body),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onCancel }, "Cancel"),
              React.createElement("button", {
                className: "btn btn-primary",
                onClick: onConfirm,
                style: danger ? { background: "var(--c-startup)", borderColor: "var(--c-startup)" } : undefined,
              },
                ctaIcon && React.createElement(Icon, { name: ctaIcon, size: 16, stroke: "var(--paper)" }),
                ctaLabel)
            )
          )
        )
      )
    );
  }

  const CODE_BOX_STYLE = {
    width: 46, height: 56, textAlign: "center",
    fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700,
    color: "var(--ink)", background: "var(--paper)",
    border: "1.5px solid var(--paper-edge)", borderRadius: 11,
    outline: "none", transition: "border-color .15s, box-shadow .15s",
  };

  // Six-box 6-digit code input (signup / reset confirmation codes). Owns the
  // per-box refs and the focus dance — type → advance, backspace on empty →
  // retreat, paste → fill and land on the first gap. The caller owns the value
  // (array of 6 strings) and receives the full next array via onChange; Enter
  // on a complete code fires onSubmit. onboarding.jsx / forgot.jsx predate
  // this and still carry their own copies — new code screens use this one.
  function CodeBoxes({ value, onChange, onSubmit, autoFocus }) {
    const refs = useRef([]);
    const ready = value.join("").length === 6;

    function setDigit(i, raw) {
      const digits = (raw || "").replace(/\D/g, "");
      // OTP autofill (and some keyboards) insert the whole code as one input
      // event rather than a paste — distribute it across the boxes.
      if (digits.length > 1) {
        const next = ["", "", "", "", "", ""];
        digits.slice(0, 6).split("").forEach((d, j) => { next[j] = d; });
        onChange(next);
        const firstEmpty = next.findIndex((c) => !c);
        const focusIdx = firstEmpty === -1 ? 5 : firstEmpty;
        refs.current[focusIdx] && refs.current[focusIdx].focus();
        return;
      }
      const digit = digits.slice(0, 1);
      const next = value.slice();
      next[i] = digit;
      onChange(next);
      if (digit && i < 5) refs.current[i + 1] && refs.current[i + 1].focus();
    }
    function onKeyDown(i, e) {
      if (e.key === "Backspace" && !value[i] && i > 0) {
        refs.current[i - 1] && refs.current[i - 1].focus();
      } else if (e.key === "Enter" && ready && onSubmit) {
        onSubmit();
      }
    }
    function onPaste(e) {
      const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;
      e.preventDefault();
      const next = ["", "", "", "", "", ""];
      pasted.split("").forEach((d, i) => { if (i < 6) next[i] = d; });
      onChange(next);
      const firstEmpty = next.findIndex((c) => !c);
      const focusIdx = firstEmpty === -1 ? 5 : firstEmpty;
      refs.current[focusIdx] && refs.current[focusIdx].focus();
    }

    return (
      React.createElement("div", { style: { display: "flex", gap: 10 }, onPaste: onPaste },
        value.map((d, i) => (
          React.createElement("input", {
            key: i,
            ref: (el) => { refs.current[i] = el; },
            type: "text", inputMode: "numeric", maxLength: 1, autoFocus: !!autoFocus && i === 0,
            // one-time-code on box 1 lets iOS/macOS offer the emailed code as
            // an autofill suggestion (it lands as a normal insertion, which
            // setDigit truncates — but without the attribute it's never offered).
            autoComplete: i === 0 ? "one-time-code" : "off",
            value: d, className: "code-box", style: CODE_BOX_STYLE,
            onChange: (e) => setDigit(i, e.target.value),
            onKeyDown: (e) => onKeyDown(i, e),
          })
        ))
      )
    );
  }

  // Contact-link field descriptors — shared by the profile editor and the
  // onboarding enrichment step so the two collect the exact same set.
  const LINK_KINDS = [
    { key: "github",    label: "GitHub URL",    placeholder: "https://github.com/yourhandle" },
    { key: "portfolio", label: "Portfolio URL", placeholder: "https://yoursite.com" },
    { key: "linkedin",  label: "LinkedIn URL",  placeholder: "https://linkedin.com/in/you" },
    { key: "instagram", label: "Instagram",     placeholder: "@your insta handle" },
  ];

  // Downscale a picked image to a JPEG dataURL (default max 800px wide) before
  // upload. Shared by the profile editor and onboarding photo steps.
  async function resizePhoto(file, maxWidth = 800) {
    const dataURL = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      // Without onerror an unreadable file would hang the promise forever and
      // soft-lock callers that gate UI on the await (e.g. onboarding's photo step).
      r.onerror = () => rej(r.error || new Error("Couldn't read that file"));
      r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      // Undecodable images (e.g. an iOS .heic in Chrome/Firefox) fire onerror, not
      // onload — reject so the caller's catch runs instead of awaiting forever.
      i.onerror = () => rej(new Error("Couldn't decode that image"));
      i.src = dataURL;
    });
    const scale = Math.min(1, maxWidth / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  }

  // Taped paper "snap" — a single photo slot in the cork-board vocabulary.
  // Editable: click to pick, hover-replace, corner-clear. Read-only: shows the
  // image with an optional caption. Used in the profile gallery and onboarding.
  function Polaroid({ label, src, cap, editable, onPick, onClear }) {
    const inputRef = useRef(null);
    return React.createElement("div", {
      className: "polaroid",
      style: editable ? { cursor: src ? "default" : "pointer", position: "relative" } : { position: "relative" },
      onClick: editable && !src ? () => inputRef.current && inputRef.current.click() : undefined,
    },
      editable && React.createElement("input", {
        type: "file", accept: "image/*", ref: inputRef, style: { display: "none" },
        onChange: (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) onPick(f);
          e.target.value = "";
        },
      }),
      React.createElement("div", { className: "ph" },
        src
          ? React.createElement("img", {
              src, alt: cap || label || "",
              style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
            })
          : React.createElement("span", { className: "pl" }, editable ? "+ pin a snap" : label)
      ),
      (cap || label) && !editable && React.createElement("div", { className: "cap" }, cap || label),
      editable && src && React.createElement("button", {
        title: "Remove photo",
        onClick: (e) => { e.stopPropagation(); onClear(); },
        style: {
          position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%",
          background: "var(--paper)", border: "1.5px solid var(--paper-edge)",
          display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
          boxShadow: "0 2px 5px -2px oklch(0.2 0.02 60/.4)",
        },
      }, React.createElement(Icon, { name: "x", size: 12 })),
      editable && src && React.createElement("button", {
        title: "Replace photo",
        onClick: (e) => { e.stopPropagation(); inputRef.current && inputRef.current.click(); },
        style: {
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          fontFamily: "var(--mono)", fontSize: 10, color: "var(--paper)",
          background: "oklch(0 0 0 / 0.55)", padding: "3px 9px", borderRadius: 4,
          border: 0, cursor: "pointer",
        },
      }, "replace")
    );
  }

  export { Av, Facepile, CatTag, Pin, Stamp, Toasts, UniLogo, formatEventDate, Skeleton, CodeBoxes, ConfirmModal, OrgMini, Polaroid, resizePhoto, LINK_KINDS };
