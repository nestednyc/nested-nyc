/* ============================================================
   NESTED NYC — shared UI atoms
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { avColor, initials } from './data'

  function Av({ name, color, size }) {
    const style = { background: color || avColor(name) };
    if (size) { style.width = size; style.height = size; style.fontSize = Math.round(size * 0.36); }
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

  // rubber stamp ".edu verified"
  function Stamp({ size = 120, className, style }) {
    return (
      React.createElement("svg", { className, style, width: size, height: size, viewBox: "0 0 120 120" },
        React.createElement("g", { fill: "none", stroke: "var(--accent)", strokeWidth: 2.5 },
          React.createElement("circle", { cx: 60, cy: 60, r: 54, strokeDasharray: "3 4", opacity: 0.85 }),
          React.createElement("circle", { cx: 60, cy: 60, r: 44 })
        ),
        React.createElement("text", { x: 60, y: 50, textAnchor: "middle", fontFamily: "Spline Sans Mono, monospace", fontSize: 14, fontWeight: 600, fill: "var(--accent)", letterSpacing: 1 }, ".EDU"),
        React.createElement("text", { x: 60, y: 68, textAnchor: "middle", fontFamily: "Spline Sans Mono, monospace", fontSize: 9, fill: "var(--accent)", letterSpacing: 1 }, "VERIFIED"),
        React.createElement("text", { x: 60, y: 82, textAnchor: "middle", fontFamily: "Spline Sans Mono, monospace", fontSize: 7, fill: "var(--accent)", letterSpacing: 1.5 }, "STUDENT")
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

  export { Av, Facepile, CatTag, Pin, Stamp, Toasts };
  export const UI = { Av, Facepile, CatTag, Pin, Stamp, Toasts };
