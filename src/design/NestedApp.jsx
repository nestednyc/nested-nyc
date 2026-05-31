/* ============================================================
   NESTED NYC — App shell, routing, state, tweaks
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { PROJECTS, NestedData, PEOPLE, CAT } from './data'
import { Av, Toasts, Stamp } from './shared'
import { useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle } from './tweaks-panel'
import Onboarding from './onboarding'
import Discover, { ProjectCard } from './discover'
import Events from './events'
import Matches from './matches'
import People, { ContactLinks } from './people'
import ProjectDetail from './detail'
import Create from './create'
import { SHOW_TWEAKS } from '../config/features'

  const { useState, useEffect, useRef } = React;

  const ACCENTS = [
    { v: "oklch(0.60 0.185 30)",  ink: "oklch(0.42 0.16 32)",  wash: "oklch(0.60 0.185 30 / 0.12)" },
    { v: "oklch(0.55 0.13 255)",  ink: "oklch(0.40 0.11 255)", wash: "oklch(0.55 0.13 255 / 0.12)" },
    { v: "oklch(0.55 0.13 152)",  ink: "oklch(0.40 0.11 152)", wash: "oklch(0.55 0.13 152 / 0.12)" },
    { v: "oklch(0.52 0.15 310)",  ink: "oklch(0.40 0.13 310)", wash: "oklch(0.52 0.15 310 / 0.12)" },
  ];

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "surface": "cork",
    "accent": "oklch(0.60 0.185 30)",
    "displayFont": "Bricolage Grotesque",
    "texture": true,
    "tilt": true
  }/*EDITMODE-END*/;

  const LS = "nested.nyc.v1";
  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
  }

  const NAV = [
    { id: "discover", label: "Discover", icon: "grid" },
    { id: "events",   label: "Events",   icon: "calendar" },
    { id: "people",   label: "People",   icon: "users" },
  ];

  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const persisted = useRef(loadState());

    const [route, setRoute] = useState(persisted.current.profile ? (persisted.current.route || "discover") : "onboarding");
    const [profile, setProfile] = useState(persisted.current.profile || null);
    const [detailId, setDetailId] = useState(persisted.current.detailId || null);
    const [saved, setSaved] = useState(new Set(persisted.current.saved || []));
    const [joined, setJoined] = useState(new Set(persisted.current.joined || []));
    const [rsvped, setRsvped] = useState(new Set(persisted.current.rsvped || []));
    const [connected, setConnected] = useState(persisted.current.connected || []);
    const [created, setCreated] = useState(persisted.current.created || []);
    const [query, setQuery] = useState("");
    const [soonLabel, setSoonLabel] = useState("Events");
    const [modal, setModal] = useState(null); // {type:'join'|'msg', project, lead}
    const [toasts, setToasts] = useState([]);
    const [justVerified, setJustVerified] = useState(false);

    // persist
    useEffect(() => {
      localStorage.setItem(LS, JSON.stringify({
        profile, route, detailId,
        saved: [...saved], joined: [...joined], rsvped: [...rsvped], connected, created,
      }));
    }, [profile, route, detailId, saved, joined, rsvped, connected, created]);

    function toast(text, icon) {
      const id = Math.random().toString(36).slice(2);
      setToasts((arr) => [...arr, { id, text, icon }]);
      setTimeout(() => setToasts((arr) => arr.filter((x) => x.id !== id)), 2800);
    }

    function openProject(id) { setDetailId(id); setRoute("detail"); window.scrollTo({ top: 0 }); }
    function toggleSave(id) {
      setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); toast(n.has(id) ? "Saved to your board" : "Removed from saved", "bookmark"); return n; });
    }
    function goNav(id) {
      if (id === "discover" || id === "events" || id === "people" || id === "saved") { setRoute(id); }
      else { setSoonLabel(NAV.find((n) => n.id === id).label); setRoute("soon"); }
      window.scrollTo({ top: 0 });
    }
    function toggleRsvp(id) {
      setRsvped((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); toast(n.has(id) ? "You're going \u2014 see you there" : "RSVP cancelled", n.has(id) ? "calendar" : "x"); return n; });
    }

    function submitModal(text) {
      if (!modal) return;
      if (modal.type === "join") {
        setJoined((j) => new Set(j).add(modal.project.id));
        toast("Request sent to " + modal.project.lead.name.split(" ")[0], "check");
      } else {
        toast("Message sent to " + modal.lead.name.split(" ")[0], "send");
      }
      setModal(null);
    }

    const projectsList = [...created, ...PROJECTS];
    const detailProject = projectsList.find((p) => p.id === detailId);
    const accent = ACCENTS.find((a) => a.v === t.accent) || ACCENTS[0];

    const rootStyle = {
      "--accent": accent.v,
      "--accent-ink": accent.ink,
      "--accent-wash": accent.wash,
      "--disp": '"' + t.displayFont + '", sans-serif',
      "--tilt": t.tilt ? 1 : 0,
    };
    const rootClass = [
      "app",
      "surface-" + t.surface,
      t.texture ? "" : "no-texture",
    ].join(" ");

    // ---------- ONBOARDING (full-screen, no topbar) ----------
    if (route === "onboarding") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(Onboarding, {
            onComplete: (p) => {
              setProfile(p); setRoute("discover"); window.scrollTo({ top: 0 });
              toast("Welcome to Nested, @" + p.username, "sparkle");
              setJustVerified(true);
              setTimeout(() => setJustVerified(false), 1500);
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- CREATE (full-screen, no topbar — same shell as onboarding) ----------
    if (route === "create") {
      return (
        React.createElement("div", { className: rootClass, style: rootStyle },
          React.createElement(Create, {
            profile,
            existingIds: new Set(projectsList.map((p) => p.id)),
            onCancel: () => setRoute("discover"),
            onCreate: (project) => {
              setCreated((arr) => [project, ...arr]);
              setRoute("discover");
              toast("Pinned to the board", "pin");
            },
          }),
          React.createElement(Toasts, { items: toasts }),
          React.createElement(StyleTweaks, { t, setTweak })
        )
      );
    }

    // ---------- MAIN APP ----------
    return (
      React.createElement("div", { className: rootClass + " corkbg", style: { ...rootStyle, minHeight: "100vh" } },
        // top bar
        React.createElement("header", { className: "topbar" },
          React.createElement("div", { className: "brand", onClick: () => goNav("discover") },
            React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
            React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
          ),
          React.createElement("nav", { className: "nav" },
            NAV.map((n) => (
              React.createElement("button", {
                key: n.id,
                className: route === n.id ? "active" : (route === "soon" && soonLabel === n.label) ? "active" : "",
                onClick: () => goNav(n.id),
              }, React.createElement(Icon, { name: n.icon, size: 18 }), n.label)
            ))
          ),
          React.createElement("div", { className: "search" },
            React.createElement(Icon, { name: "search", size: 18 }),
            React.createElement("input", {
              placeholder: "Search projects, skills, schools…", value: query,
              onChange: (e) => { setQuery(e.target.value); if (route !== "discover") setRoute("discover"); },
            })
          ),
          React.createElement("button", { className: "iconbtn", onClick: () => goNav("saved"), title: "Saved projects" },
            React.createElement(Icon, { name: "bookmark", size: 20 })),
          React.createElement("button", { className: "iconbtn", onClick: () => { setSoonLabel("Notifications"); setRoute("soon"); }, title: "Notifications" },
            React.createElement(Icon, { name: "bell", size: 20 }), React.createElement("span", { className: "dot" })),
          profile && justVerified && React.createElement("span", {
            className: "corner-stamp enter",
            title: "@" + profile.username + " · verified .edu student",
          }, React.createElement(Stamp, { size: 44 })),
          profile && React.createElement("button", { className: "me-chip", onClick: () => { setSoonLabel("Profile"); setRoute("soon"); } },
            React.createElement(Av, { name: profile.username }),
            React.createElement("span", { className: "who" },
              React.createElement("b", null, "@" + profile.username),
              React.createElement("small", null, (NestedData.UNI[profile.uni] || {}).name)
            )
          )
        ),

        route === "discover" && React.createElement(Discover, {
          projects: projectsList, profile, saved, joined, query,
          onOpen: openProject, onSave: toggleSave,
          onStart: () => setRoute("create"),
        }),

        route === "events" && React.createElement(Events, {
          rsvped, onRSVP: toggleRsvp,
        }),

        route === "people" && React.createElement(People, {
          initialConnected: connected,
          onConnectedChange: (arr) => setConnected(arr),
          onToast: toast,
        }),

        route === "saved" && React.createElement(Matches, {
          projects: projectsList, profile,
          saved, joined, onOpen: openProject, onSave: toggleSave,
          onStart: () => setRoute("create"),
          onBrowse: () => goNav("discover"),
        }),

        route === "detail" && detailProject && React.createElement(ProjectDetail, {
          p: detailProject, saved: saved.has(detailProject.id), joined: joined.has(detailProject.id),
          onBack: () => setRoute("discover"),
          onSave: toggleSave,
          onRequest: (p) => { if (joined.has(p.id)) { toast("You've already requested to join", "check"); } else { setModal({ type: "join", project: p }); } },
          onMessage: (lead) => setModal({ type: "contact", lead }),
        }),

        route === "soon" && React.createElement(SoonPane, { label: soonLabel, saved, joined, projects: projectsList, onOpen: openProject, onSave: toggleSave, onBack: () => goNav("discover") }),

        modal && React.createElement(Modal, { modal, onClose: () => setModal(null), onSubmit: submitModal, profile }),
        React.createElement(Toasts, { items: toasts }),
        React.createElement(StyleTweaks, { t, setTweak })
      )
    );
  }

  // ---------- Request / Message modal ----------
  function Modal({ modal, onClose, onSubmit, profile }) {
    const [text, setText] = useState("");
    const isJoin = modal.type === "join";
    if (!isJoin) {
      const lead = modal.lead;
      const person = (PEOPLE || []).find((p) => p.name === lead.name);
      const links = person ? person.links : [{ kind: "email", label: lead.name.split(" ")[0].toLowerCase() + "@edu" }];
      return (
        React.createElement("div", { className: "scrim", onClick: onClose },
          React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "cat-bar", style: { background: "var(--accent)" } }),
            React.createElement("button", { className: "modal-close", onClick: onClose }, React.createElement(Icon, { name: "x", size: 18 })),
            React.createElement("div", { className: "modal-inner" },
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 13, marginBottom: 16 } },
                React.createElement(Av, { name: lead.name }),
                React.createElement("div", null,
                  React.createElement("h2", { style: { fontSize: 23, marginBottom: 2 } }, "Reach " + lead.name.split(" ")[0]),
                  React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)" } }, lead.role))),
              ContactLinks
                ? React.createElement(ContactLinks, { person: { links } })
                : React.createElement("div", { className: "links" }, links.map((l, i) => React.createElement("span", { className: "linkpill", key: i }, l.label)))
            )
          )
        )
      );
    }
    const cat = isJoin ? CAT[modal.project.cat] : CAT.startup;
    const lead = isJoin ? modal.project.lead : modal.lead;
    const placeholder = isJoin
      ? "Hi " + lead.name.split(" ")[0] + " — I'm " + (profile ? "@" + profile.username : "a student") + ". I'd love to help with this because…"
      : "Say hi to " + lead.name.split(" ")[0] + "…";
    return (
      React.createElement("div", { className: "scrim", onClick: onClose },
        React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "cat-bar", style: { background: cat.color } }),
          React.createElement("button", { className: "modal-close", onClick: onClose }, React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("h2", null, isJoin ? "Request to join" : "Message " + lead.name.split(" ")[0]),
            React.createElement("p", null, isJoin
              ? ["Send a note to ", React.createElement("b", { key: "b" }, lead.name), ", who's leading ", React.createElement("b", { key: "b2" }, "\u201C" + modal.project.title.split(" — ")[0] + "\u201D"), ". A line about why you're a fit goes a long way."]
              : ["Direct message to ", React.createElement("b", { key: "b" }, lead.name), " · ", lead.role, "."]),
            React.createElement("textarea", { placeholder, value: text, autoFocus: true, onChange: (e) => setText(e.target.value) }),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onClose }, "Cancel"),
              React.createElement("button", { className: "btn btn-primary", onClick: () => onSubmit(text) },
                React.createElement(Icon, { name: "send", size: 16, stroke: "var(--paper)" }),
                isJoin ? "Send request" : "Send message")
            )
          )
        )
      )
    );
  }

  // ---------- "near-future surface" placeholder ----------
  function SoonPane({ label, saved, joined, projects, onOpen, onSave, onBack }) {
    // Matches shows saved projects if any
    if (label === "Matches" && saved.size > 0) {
      const list = projects.filter((p) => saved.has(p.id));
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "disco-head" },
            React.createElement("div", null,
              React.createElement("h1", null, "Your ", React.createElement("em", null, "saved"), " board"),
              React.createElement("p", { className: "sub" }, "Projects you've pinned for later. The full Matches surface (your projects, requests, recommendations) is coming soon.")
            )
          ),
          React.createElement("div", { className: "board", style: { marginTop: 18 } },
            list.map((p) => React.createElement(ProjectCard, {
              key: p.id, p, saved: saved.has(p.id), joined: joined.has(p.id), onOpen, onSave,
            }))
          )
        )
      );
    }
    const copy = {
      Events: ["Events across NYC campuses", "Hackathons, demo days, mixers and workshops from every school on Nested — in one feed."],
      Matches: ["Your matches & saved", "Projects you've saved, your own projects, and requests to join will live here."],
      Messages: ["Messages", "Direct messages with the students you're building alongside."],
      Profile: ["Your profile", "Your major, school, interests, photos, and the links teammates use to reach you."],
      Notifications: ["Notifications", "Replies to your join requests, new connections, and events you RSVP'd to will surface here."],
      "Create a project": ["Pin a new project", "Post what you're building and the roles you need. Recruit teammates from every NYC campus."],
    }[label] || [label, "Coming soon."];
    return (
      React.createElement("div", { className: "soon" },
        React.createElement("div", { className: "badge" }, React.createElement(Icon, { name: label === "Create a project" ? "plus" : (NAV.find((n) => n.label === label) || {}).icon || "sparkle", size: 40, stroke: "var(--accent)" })),
        React.createElement("h2", null, copy[0]),
        React.createElement("p", null, copy[1]),
        React.createElement("div", { className: "mono" }, "// behind a feature flag · near-future surface"),
        React.createElement("button", { className: "btn btn-primary", style: { marginTop: 24 }, onClick: onBack },
          React.createElement(Icon, { name: "arrowLeft", size: 16, stroke: "var(--paper)" }), "Back to the board")
      )
    );
  }

  // ---------- Tweaks ----------
  function StyleTweaks({ t, setTweak }) {
    if (!SHOW_TWEAKS) return null;
    return (
      React.createElement(TweaksPanel, { title: "Tweaks" },
        React.createElement(TweakSection, { label: "Overall style" }),
        React.createElement(TweakRadio, {
          label: "Surface", value: t.surface, options: ["cork", "newsprint", "riso"],
          onChange: (v) => setTweak("surface", v),
        }),
        React.createElement(TweakColor, {
          label: "Accent", value: t.accent,
          options: ACCENTS.map((a) => a.v),
          onChange: (v) => setTweak("accent", v),
        }),
        React.createElement(TweakRadio, {
          label: "Display font", value: t.displayFont, options: ["Bricolage Grotesque", "Anton"],
          onChange: (v) => setTweak("displayFont", v),
        }),
        React.createElement(TweakSection, { label: "Texture" }),
        React.createElement(TweakToggle, { label: "Paper grain", value: t.texture, onChange: (v) => setTweak("texture", v) }),
        React.createElement(TweakToggle, { label: "Pinned tilt", value: t.tilt, onChange: (v) => setTweak("tilt", v) })
      )
    );
  }

  export { App as NestedApp };
  export default App;
