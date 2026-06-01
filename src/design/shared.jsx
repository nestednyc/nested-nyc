/* ============================================================
   NESTED NYC — shared UI atoms
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { avColor, initials } from './data'

  const { useState } = React;

  function Av({ name, color, size, img }) {
    const style = { background: color || avColor(name) };
    if (size) { style.width = size; style.height = size; style.fontSize = Math.round(size * 0.36); }
    if (img) {
      return React.createElement("span", { className: "av", style },
        React.createElement("img", {
          src: img, alt: name, loading: "lazy",
          style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" },
        }));
    }
    return React.createElement("span", { className: "av", style }, initials(name));
  }

  function Facepile({ names, extra }) {
    return (
      React.createElement("div", { className: "facepile" },
        names.map((n, i) => React.createElement(Av, { key: i, name: n })),
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

  export { Av, Facepile, CatTag, Pin, Stamp, Toasts, UniLogo, formatEventDate };
  export const UI = { Av, Facepile, CatTag, Pin, Stamp, Toasts, UniLogo, formatEventDate };
