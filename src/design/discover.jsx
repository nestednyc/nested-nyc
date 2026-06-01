/* ============================================================
   NESTED NYC — Discover feed (the bulletin board)
   Flyers are taped/pinned to the wall — peel the tape or pull
   the pin and they tip and fall off. Re-pin to put them back.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CATEGORIES, CAT, UNI, statusMeta } from './data'
import { Facepile, CatTag, Pin } from './shared'

  const { useState, useMemo, useRef } = React;

  // a single peelable tape strip — animates its peel, then reports up
  function TapeStrip({ side, onPeeled, hint }) {
    const [peeling, setPeeling] = useState(false);
    return (
      React.createElement("span", {
        className: "tape " + side + (peeling ? " peel-" + side : " peelable") + (hint ? " hint" : ""),
        title: "Peel the tape",
        onClick: (e) => {
          e.stopPropagation();
          if (peeling) return;
          setPeeling(true);
          setTimeout(() => onPeeled(side), 320);
        },
      })
    );
  }

  function PinFastener({ onPulled, hint }) {
    const [pulling, setPulling] = useState(false);
    return (
      React.createElement("svg", {
        className: "pin" + (pulling ? " pull" : " peelable") + (hint ? " hint" : ""),
        viewBox: "0 0 30 30", title: "Pull the pin",
        onClick: (e) => {
          e.stopPropagation();
          if (pulling) return;
          setPulling(true);
          setTimeout(() => onPulled("pin"), 280);
        },
      },
        React.createElement("circle", { cx: 15, cy: 12, r: 9, fill: "var(--accent)" }),
        React.createElement("circle", { cx: 15, cy: 12, r: 9, fill: "none", stroke: "var(--accent-ink)", strokeWidth: 1 }),
        React.createElement("ellipse", { cx: 12, cy: 9, rx: 3, ry: 2, fill: "oklch(1 0 0 / 0.45)" }),
        React.createElement("path", { d: "M15 21v7", stroke: "var(--accent-ink)", strokeWidth: 2, strokeLinecap: "round" })
      )
    );
  }

  function ProjectCard({ p, saved, joined, onOpen, onSave, onEdit, hint, fasteners, onPeel, sticking }) {
    const cat = CAT[p.cat];
    const openRoles = p.roles.filter((r) => r.open);
    const teamNames = [p.lead.name, ...p.team.map((t) => t.name)];
    const shown = teamNames.slice(0, 3);
    const extra = Math.max(0, p.joinedCount - shown.length);
    const joinedTxt = "Joined by " + teamNames.slice(0, 2).map((n) => n.split(" ")[0]).join(", ") + (extra > 0 ? " +" + extra : "");

    const isTape = p.pinType === "tape";
    // Controlled if parent passes onPeel; otherwise the card owns its own fasteners.
    const controlled = typeof onPeel === "function";
    const [localFast, setLocalFast] = useState(isTape ? ["left", "right"] : ["pin"]);
    const fast = controlled ? (fasteners ?? (isTape ? ["left", "right"] : ["pin"])) : localFast;
    const fell = fast.length === 0;
    const interactive = !fell;
    const peel = controlled
      ? (which) => onPeel(p.id, which)
      : (which) => setLocalFast((arr) => arr.filter((s) => s !== which));

    // random fall params, stable per card instance
    const fall = useRef(null);
    if (!fall.current) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      fall.current = {
        fx: (18 + Math.random() * 34) * dir + "px",
        fr: (52 + Math.random() * 46) * dir + "deg",
        d1: (6 + Math.random() * 6) * dir + "deg",
        sx: (Math.random() * 16 - 8) + "px",
      };
    }

    // class + style driven by fastener state
    let cls = "flyer grain";
    const style = { "--rot": p.rot };
    if (fell) {
      cls += " is-falling";
      style["--fx"] = fall.current.fx; style["--fr"] = fall.current.fr; style["--d1"] = fall.current.d1;
    } else if (isTape && fast.length === 1) {
      cls += fast[0] === "left" ? " dangle-left" : " dangle-right";
    } else if (sticking) {
      cls += " is-sticking"; style["--sx"] = fall.current.sx;
    }

    return (
      React.createElement("article", {
        className: cls, style,
        onClick: () => { if (!fell) onOpen(p.id); },
      },
        // fasteners
        isTape
          ? fast.map((s) => (interactive
              ? React.createElement(TapeStrip, { key: s, side: s, hint: hint && s === "right", onPeeled: peel })
              : React.createElement("span", { key: s, className: "tape " + s })))
          : (fast.length
              ? (interactive
                  ? React.createElement(PinFastener, { key: "pin", hint, onPulled: peel })
                  : React.createElement(Pin, { key: "pin" }))
              : null),

        React.createElement("div", { className: "cat-bar", style: { background: p.flyerColor || cat.color } }),
        React.createElement("div", { className: "body" },
          React.createElement("div", { className: "stamp-meta" }, UNI[p.uni].name),
          React.createElement(CatTag, { cat }),
          React.createElement("h3", null, p.title),
          React.createElement("p", { className: "blurb" }, p.blurb),
          (() => { const m = statusMeta(p.status); return React.createElement("div", { className: "card-status" },
            React.createElement("span", { className: "status-pill sm", style: { color: m.ink, background: m.wash } },
              React.createElement("span", { className: "status-dot", style: { background: m.ink } }), m.label),
            p.alert && p.alert.trim() && React.createElement("span", { className: "card-alert" }, p.alert)
          ); })(),
          openRoles.length > 0 && React.createElement("div", { className: "looking" },
            React.createElement("span", { className: "role", style: { borderStyle: "solid", background: "transparent", borderColor: "transparent", paddingLeft: 0, color: "var(--ink-faint)" } }, "looking for:"),
            openRoles.map((r, i) => React.createElement("span", { className: "role", key: i }, r.title))
          ),
          React.createElement("div", { className: "meta" },
            React.createElement("div", { className: "joined-by" },
              React.createElement(Facepile, { names: shown, extra }),
              React.createElement("span", { className: "txt" }, joinedTxt)
            ),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
              React.createElement("button", {
                className: "savebtn" + (saved ? " on" : ""), title: saved ? "Saved" : "Save",
                onClick: (e) => { e.stopPropagation(); onSave(p.id); },
              }, React.createElement(Icon, { name: "bookmark", size: 17, fill: saved ? "var(--accent)" : "none" })),
              onEdit
                ? React.createElement("button", {
                    className: "btn btn-primary",
                    title: "Edit your flyer",
                    onClick: (e) => { e.stopPropagation(); onEdit(p); },
                  }, React.createElement(Icon, { name: "pin", size: 16, stroke: "var(--paper)" }), "Edit")
                : React.createElement("button", {
                    className: "btn " + (joined ? "btn-primary done" : "btn-primary"),
                    onClick: (e) => { e.stopPropagation(); onOpen(p.id); },
                  }, joined ? [React.createElement(Icon, { name: "check", size: 16, stroke: "var(--paper)", key: "i" }), "Requested"] : "Join")
            )
          )
        )
      )
    );
  }

  // ---- one category shelf with flip-and-print pagination ----
  function FeedRow({ feed, feedIndex = 0, saved, joined, onOpen, onSave }) {
    const cols = feed.cols || 4;
    const rows = feed.rows || 1;
    const pageSize = feed.pageSize || cols * rows;
    const pages = Math.max(1, Math.ceil(feed.items.length / pageSize));
    const [shown, setShown] = useState(0);
    const [phase, setPhase] = useState("in");
    const timer = useRef(null);

    // Per-shelf fastener state — present key = dirty, [] = fell, [...] = partially peeled / pristine override.
    const [fasteners, setFasteners] = useState({});
    // Cards currently mid re-pin animation (cleared after the stickUp keyframe runs).
    const [sticking, setSticking] = useState(() => new Set());
    const stickTimer = useRef(null);
    const dirtyCount = Object.keys(fasteners).length;

    function peel(id, which) {
      setFasteners((prev) => {
        const item = feed.items.find((x) => x.id === id);
        if (!item) return prev;
        const base = prev[id] ?? (item.pinType === "tape" ? ["left", "right"] : ["pin"]);
        return { ...prev, [id]: base.filter((s) => s !== which) };
      });
    }

    function repinAll() {
      const fallenIds = Object.entries(fasteners)
        .filter(([, arr]) => arr.length === 0)
        .map(([id]) => id);
      setFasteners({});
      if (fallenIds.length) {
        setSticking(new Set(fallenIds));
        clearTimeout(stickTimer.current);
        stickTimer.current = setTimeout(() => setSticking(new Set()), 620);
      }
    }

    function go(np) {
      if (pages <= 1 || phase === "out" || np === shown || np < 0 || np >= pages) return;
      setPhase("out");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { setShown(np); setPhase("in"); }, 480);
    }

    const items = feed.items.slice(shown * pageSize, shown * pageSize + pageSize);

    return (
      React.createElement("section", { className: "feed" },
        React.createElement("div", { className: "feed-head" },
          React.createElement("div", { className: "feed-title" },
            React.createElement("span", { className: "dot", style: { background: feed.color } }),
            React.createElement("h2", null, feed.label),
            feed.sub && React.createElement("span", { className: "fsub" }, "// " + feed.sub)
          ),
          React.createElement("div", { className: "feed-controls" },
            dirtyCount > 0 && React.createElement("button", {
              className: "repin-btn", title: "Put fallen cards back on the board", onClick: repinAll,
            },
              React.createElement(Icon, { name: "pin", size: 16, stroke: "var(--accent)" }),
              "Re-pin board"),
            pages > 1 && React.createElement("div", { className: "feed-pager" },
              React.createElement("button", { className: "prev-pin", title: "Previous", disabled: shown === 0, onClick: () => go(shown - 1) },
                React.createElement(Icon, { name: "arrowLeft", size: 18 })),
              React.createElement("div", { className: "pin-dots" },
                Array.from({ length: pages }).map((_, i) => (
                  React.createElement("button", { key: i, className: "pin-dot" + (i === shown ? " on" : ""), title: "Page " + (i + 1), onClick: () => go(i) })
                ))
              ),
              React.createElement("button", { className: "next-pin", title: "Next page", disabled: shown >= pages - 1, onClick: () => go(shown + 1) },
                "Next",
                React.createElement("span", { className: "arrow" }, React.createElement(Icon, { name: "arrowRight", size: 16, stroke: "var(--paper)" }))
              )
            )
          )
        ),
        React.createElement("div", { className: "feed-grid fixed", style: { "--cols": cols } },
          items.length === 0
            ? React.createElement("div", { className: "feed-empty" }, "// nothing here yet")
            : items.map((p, i) => {
                const col = i % cols;
                const sign = (i % 2) ? -1 : 1;
                return React.createElement("div", {
                  className: "feed-cell " + (phase === "out" ? "out" : "in"),
                  key: shown + ":" + p.id,
                  style: {
                    animationDelay: (col * 55) + "ms",
                    "--enter-rot": (sign * 3) + "deg",
                    "--exit-rot": (-sign * 3) + "deg",
                  },
                },
                  React.createElement(ProjectCard, {
                    p, saved: saved.has(p.id), joined: joined.has(p.id), onOpen, onSave,
                    hint: feedIndex === 0 && shown === 0 && i === 0,
                    fasteners: fasteners[p.id],
                    onPeel: peel,
                    sticking: sticking.has(p.id),
                  })
                );
              })
        )
      )
    );
  }

  function Discover({ projects, profile, saved, joined, query, onOpen, onSave, onStart }) {
    const [cat, setCat] = useState("all");

    const counts = useMemo(() => {
      const c = {};
      projects.forEach((p) => { c[p.cat] = (c[p.cat] || 0) + 1; });
      return c;
    }, [projects]);

    // build the category shelves
    const feeds = useMemo(() => {
      const byId = (id) => projects.find((p) => p.id === id);
      const pick = (ids) => ids.map(byId).filter(Boolean);
      const popular = [...projects].sort((a, b) => b.joinedCount - a.joinedCount);
      return [
        { id: "popular",  label: "Popular now",      sub: "most students joining",    color: "var(--c-startup)", cols: 4, rows: 1, items: popular },
        { id: "featured", label: "Featured",         sub: "editors' picks this week", color: "var(--c-hack)",    cols: 4, rows: 2, items: pick(["subway-pulse", "loop", "threadbare", "nyc-air", "inkwell", "greenmap", "setlist", "studyroom"]) },
        { id: "new",      label: "New on Nested",     sub: "just pinned",              color: "var(--c-side)",    cols: 4, rows: 1, items: pick(["setlist", "threadbare", "riso-club", "studyroom", "greenmap", "nyc-air"]) },
        { id: "beginner", label: "Beginner-friendly", sub: "great first projects",     color: "var(--c-class)",   cols: 4, rows: 1, items: pick(["greenmap", "setlist", "riso-club", "inkwell", "studyroom"]) },
      ];
    }, [projects]);

    const q = query.trim().toLowerCase();
    const matches = projects.filter((p) => {
      if (cat !== "all" && p.cat !== cat) return false;
      if (q) {
        const hay = (p.title + " " + p.blurb + " " + p.tags.join(" ") + " " + UNI[p.uni].name).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const firstName = (profile.username || "there").split(/[._]/)[0];

    // when searching or filtering by category, collapse to a single feed
    const single = q
      ? { id: "results", label: "Results", sub: matches.length + " for \u201C" + query.trim() + "\u201D", color: "var(--accent)", items: matches, cols: 4, rows: 2 }
      : cat !== "all"
        ? { id: cat, label: CAT[cat].label, sub: (counts[cat] || 0) + " projects", color: CAT[cat].color, items: matches, cols: 4, rows: 2 }
        : null;

    return (
      React.createElement("div", { className: "discover" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Hey ", React.createElement("em", null, firstName), " — what are we building today?"),
            React.createElement("p", { className: "sub" }, "A feed of student-led projects across NYC. Page through each shelf, or pin your own.")
          ),
          React.createElement("div", { className: "board-actions" },
            React.createElement("button", { className: "start-btn", onClick: onStart },
              React.createElement(Icon, { name: "plus", size: 19, stroke: "var(--paper)" }),
              "Start a project")
          )
        ),

        React.createElement("div", { className: "filters" },
          React.createElement("button", { className: "chip-filter" + (cat === "all" ? " active" : ""), onClick: () => setCat("all") },
            React.createElement(Icon, { name: "grid", size: 17 }), "All",
            React.createElement("span", { className: "count" }, projects.length)
          ),
          CATEGORIES.map((c) => (
            React.createElement("button", { key: c.id, className: "chip-filter" + (cat === c.id ? " active" : ""), onClick: () => setCat(c.id) },
              React.createElement(Icon, { name: c.icon, size: 17, stroke: cat === c.id ? "var(--paper)" : c.color }),
              c.label,
              React.createElement("span", { className: "count" }, counts[c.id] || 0)
            )
          ))
        ),

        single
          ? (single.items.length === 0
              ? React.createElement("div", { className: "empty" },
                  React.createElement("div", { style: { fontFamily: "var(--disp)", fontWeight: 800, fontSize: 28, marginBottom: 8 } }, "Nothing pinned here yet"),
                  React.createElement("div", { className: "mono" }, "// try another category or clear your search"))
              : React.createElement("div", { className: "feeds" }, React.createElement(FeedRow, { key: single.id + ":" + q + ":" + cat, feed: single, saved, joined, onOpen, onSave })))
          : React.createElement("div", { className: "feeds" },
              feeds.map((f, i) => React.createElement(FeedRow, { key: f.id, feedIndex: i, feed: f, saved, joined, onOpen, onSave })))
      )
    );
  }

  export { Discover, ProjectCard };
  export default Discover;
