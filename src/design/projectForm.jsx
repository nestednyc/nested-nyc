/* ============================================================
   NESTED NYC — Project form (shared 5-step body for Create & Edit)
   category → stage+timeline → identity → recruit → pin/save
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CATEGORIES, CAT, UNI, INTERESTS, STAGES, COMMITMENTS } from './data'
import { Av, Facepile, CatTag, Pin } from './shared'

  const { useState } = React;

  const STEP_COUNT = 5;
  const PIN_STYLES = [
    { id: "tape", label: "Masking tape", note: "two strips across the top" },
    { id: "pin",  label: "Push pin",     note: "one centered pin" },
  ];
  // Approx hex per category — only seeds the native color input's swatch; the
  // live flyer still uses the exact CSS var until the user picks a custom color.
  const CAT_HEX = { startup: "#c0563b", class: "#4f6bd0", hack: "#b8902f", side: "#3f9d6c", research: "#9b4dca" };

  const EMPTY_VALUES = {
    cat: "",
    stage: "",
    timeline: "",
    title: "",
    tagline: "",
    place: "",
    about: "",
    roles: [{ title: "", note: "", open: true }],
    tags: [],
    commitment: "",
    pinType: "tape",
    commLink: "",
    flyerColor: "",
  };

  function ProjectForm({
    mode = "create",
    initialValues,
    profile,
    aside,
    ctaCopy,
    onSubmit,
    onCancel,
    extraFooter,
  }) {
    const init = { ...EMPTY_VALUES, ...(initialValues || {}) };
    // Make sure roles is always a non-empty array (UI always shows ≥1 row).
    if (!Array.isArray(init.roles) || init.roles.length === 0) {
      init.roles = [{ title: "", note: "", open: true }];
    }

    const [step, setStep] = useState(0);
    const [cat, setCat] = useState(init.cat);
    const [stage, setStage] = useState(init.stage);
    const [timeline, setTimeline] = useState(init.timeline);
    const [title, setTitle] = useState(init.title);
    const [tagline, setTagline] = useState(init.tagline);
    const [place, setPlace] = useState(init.place);
    const [about, setAbout] = useState(init.about);
    const [roles, setRoles] = useState(init.roles);
    const [tags, setTags] = useState(init.tags || []);
    const [commitment, setCommitment] = useState(init.commitment);
    const [pinType, setPinType] = useState(init.pinType || "tape");
    const [commLink, setCommLink] = useState(init.commLink || "");
    const [flyerColor, setFlyerColor] = useState(init.flyerColor || "");

    const editable = mode === "edit";
    const cta = ctaCopy || { primary: "Pin to the board", icon: "pin" };

    function next() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); }
    function back() { setStep((s) => Math.max(s - 1, 0)); }
    function jumpTo(i) { if (editable) setStep(i); }

    function updateRole(i, key, val) {
      setRoles((rs) => rs.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
    }
    function addRole() {
      setRoles((rs) => [...rs, { title: "", note: "", open: true }]);
    }
    function removeRole(i) {
      setRoles((rs) => rs.length <= 1 ? rs : rs.filter((_, idx) => idx !== i));
    }
    function toggleTag(t) {
      setTags((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]);
    }

    const cleanRoles = roles
      .map((r) => ({ ...r, title: (r.title || "").trim(), note: (r.note || "").trim() }))
      .filter((r) => r.title);

    const stepGates = [
      !!cat,
      !!stage && !!timeline.trim(),
      !!title.trim() && !!tagline.trim() && !!place.trim(),
      !!about.trim() && cleanRoles.length >= 1 && !!commitment,
      true,
    ];
    const canNext = stepGates[step];
    const allValid = stepGates.slice(0, 4).every(Boolean);

    function submit() {
      if (!allValid) return;
      onSubmit({
        cat,
        stage,
        timeline: timeline.trim(),
        title: title.trim(),
        tagline: tagline.trim(),
        place: place.trim(),
        about: about.trim(),
        roles: cleanRoles,
        tags,
        commitment,
        pinType,
        commLink: commLink.trim(),
        flyerColor,
      });
    }

    // Values passed to the aside render-prop on every render (for live previews).
    const currentValues = { cat, stage, timeline, title, tagline, place, about, roles, tags, commitment, pinType, commLink, flyerColor };

    // ---------- step bodies ----------
    let body;
    if (step === 0) {
      body = (
        React.createElement("div", { className: "fade-up", key: "c0" },
          React.createElement("span", { className: "onb-kicker" }, "Step 1 · The category"),
          React.createElement("h1", null, "What are you pinning?"),
          React.createElement("p", { className: "desc" }, "Pick the kind of project. This sets the color stripe on your flyer and where it shows up on the board."),
          React.createElement("div", { className: "field" },
            React.createElement("div", { className: "chips-grid" },
              CATEGORIES.map((c) => {
                const on = cat === c.id;
                return React.createElement("button", {
                  key: c.id,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setCat(c.id),
                  style: { gap: 8 },
                },
                  React.createElement(Icon, { name: c.icon, size: 16, width: 2, stroke: on ? "var(--paper)" : c.color }),
                  c.label
                );
              })
            )
          )
        )
      );
    } else if (step === 1) {
      body = (
        React.createElement("div", { className: "fade-up", key: "c1" },
          React.createElement("span", { className: "onb-kicker" }, "Step 2 · Where it's at"),
          React.createElement("h1", null, "What stage are we in?"),
          React.createElement("p", { className: "desc" }, "Be honest — students filter by stage. “Just an idea” pulls in co-founders; “Active sprint” pulls in people who want to ship now."),
          React.createElement("div", { className: "field" },
            React.createElement("div", { className: "chips-grid" },
              STAGES.map((s) => {
                const on = stage === s.id;
                return React.createElement("button", {
                  key: s.id,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setStage(s.id),
                  title: s.note,
                }, s.label);
              })
            )
          ),
          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Timeline"),
            React.createElement("div", { className: "input-wrap" },
              React.createElement(Icon, { name: "calendar", size: 18 }),
              React.createElement("input", {
                placeholder: "Spring 2026, NYU Hack '26, ongoing…",
                value: timeline,
                onChange: (e) => setTimeline(e.target.value),
                onKeyDown: (e) => { if (e.key === "Enter" && canNext && !editable) next(); },
              })
            ),
            React.createElement("div", { className: "hint" }, "// shows up under “Timeline” on the project page")
          )
        )
      );
    } else if (step === 2) {
      const uniName = (profile && profile.uni && UNI[profile.uni]) ? UNI[profile.uni].name : null;
      body = (
        React.createElement("div", { className: "fade-up", key: "c2" },
          React.createElement("span", { className: "onb-kicker" }, "Step 3 · The flyer"),
          React.createElement("h1", null, "Give it a name."),
          React.createElement("p", { className: "desc" }, "Title, one-line pitch, and where it's based. Keep the pitch tight — it's what people read on the board."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Project name"),
            React.createElement("div", { className: "input-wrap" + (title && title.trim() ? " good" : "") },
              React.createElement(Icon, { name: "pin", size: 17 }),
              React.createElement("input", {
                placeholder: "Subway Pulse",
                value: title,
                maxLength: 60,
                autoFocus: true,
                onChange: (e) => setTitle(e.target.value),
              })
            ),
            React.createElement("div", { className: "hint" },
              "// posting as ",
              React.createElement("b", null, "@" + (profile && profile.username ? profile.username : "you")),
              uniName ? " · " + uniName : ""
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Tagline"),
            React.createElement("div", { className: "input-wrap" + (tagline && tagline.trim() ? " good" : "") },
              React.createElement(Icon, { name: "sparkle", size: 17 }),
              React.createElement("input", {
                placeholder: "Real-time NYC subway crowding, built with riders",
                value: tagline,
                maxLength: 100,
                onChange: (e) => setTagline(e.target.value),
              })
            ),
            React.createElement("div", { className: "hint" }, "// " + tagline.length + " / 100")
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Where"),
            React.createElement("div", { className: "input-wrap" + (place && place.trim() ? " good" : "") },
              React.createElement(Icon, { name: "map", size: 17 }),
              React.createElement("input", {
                placeholder: "Cooper Engineering Lab, NYU Tisch, remote…",
                value: place,
                onChange: (e) => setPlace(e.target.value),
              })
            ),
            React.createElement("div", { className: "hint" }, "// shown under “Based at” on the project page")
          )
        )
      );
    } else if (step === 3) {
      body = (
        React.createElement("div", { className: "fade-up", key: "c3" },
          React.createElement("span", { className: "onb-kicker" }, "Step 4 · Recruit"),
          React.createElement("h1", null, "Who are you looking for?"),
          React.createElement("p", { className: "desc" }, "Tell people what the project is about and which roles are open. Add a quick note on each role so it's obvious who's a fit."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "About this project"),
            React.createElement("textarea", {
              className: "ta",
              placeholder: "What is it? What problem does it solve? What's exciting about it right now?",
              value: about,
              rows: 4,
              maxLength: 500,
              onChange: (e) => setAbout(e.target.value),
            }),
            React.createElement("div", { className: "hint" }, "// " + about.length + " / 500")
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Roles open"),
            React.createElement("div", { className: "role-builder" },
              roles.map((r, i) => (
                React.createElement("div", { className: "row", key: i },
                  React.createElement("input", {
                    className: "rb-title",
                    placeholder: "Role (e.g. iOS engineer)",
                    value: r.title,
                    onChange: (e) => updateRole(i, "title", e.target.value),
                  }),
                  React.createElement("input", {
                    className: "rb-note",
                    placeholder: "Short note (swift + maps experience)",
                    value: r.note,
                    onChange: (e) => updateRole(i, "note", e.target.value),
                  }),
                  React.createElement("button", {
                    type: "button",
                    className: "rb-open" + (r.open ? " on" : ""),
                    title: r.open ? "Marked as open" : "Marked as filled",
                    onClick: () => updateRole(i, "open", !r.open),
                  }, r.open ? "Open" : "Filled"),
                  React.createElement("button", {
                    type: "button",
                    className: "rb-x",
                    title: "Remove role",
                    onClick: () => removeRole(i),
                    disabled: roles.length <= 1,
                    style: roles.length <= 1 ? { opacity: 0.3, pointerEvents: "none" } : {},
                  }, React.createElement(Icon, { name: "x", size: 14 }))
                )
              )),
              React.createElement("button", { type: "button", className: "add", onClick: addRole },
                React.createElement(Icon, { name: "plus", size: 14 }), "Add another role"
              )
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Tags ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional · ", tags.length, " selected")),
            React.createElement("div", { className: "chips-grid" },
              INTERESTS.map((t) => {
                const on = tags.includes(t);
                return React.createElement("button", {
                  key: t,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => toggleTag(t),
                },
                  on && React.createElement(Icon, { name: "check", size: 13, width: 2.4 }),
                  t
                );
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Commitment"),
            React.createElement("div", { className: "chips-grid" },
              COMMITMENTS.map((c) => {
                const on = commitment === c.id;
                return React.createElement("button", {
                  key: c.id,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setCommitment(c.id),
                  title: c.note,
                }, c.label);
              })
            )
          )
        )
      );
    } else {
      const previewCat = cat ? CAT[cat] : CAT.startup;
      const previewUni = (profile && profile.uni && UNI[profile.uni]) ? UNI[profile.uni].name : "Nested";
      const openCount = cleanRoles.filter((r) => r.open).length;
      const openTitles = cleanRoles.filter((r) => r.open).slice(0, 3).map((r) => r.title);
      const isTape = pinType === "tape";
      body = (
        React.createElement("div", { className: "fade-up", key: "c4" },
          React.createElement("span", { className: "onb-kicker" }, editable ? "Step 5 · Save it" : "Step 5 · Pin it"),
          React.createElement("h1", null, editable ? "Ready to save?" : "Ready to pin?"),
          React.createElement("p", { className: "desc" }, editable
            ? "Confirm how it sticks to the board and save your changes. You can keep tweaking later."
            : "Pick how it sticks to the board, then send it up. You can re-pin or take it down later."),

          React.createElement("div", { className: "create-preview-wrap" },
            React.createElement("article", {
              className: "flyer grain create-preview-flyer",
              style: { "--rot": "-2deg" },
            },
              isTape
                ? [
                    React.createElement("span", { key: "l", className: "tape left" }),
                    React.createElement("span", { key: "r", className: "tape right" }),
                  ]
                : React.createElement(Pin, null),
              React.createElement("div", { className: "cat-bar", style: { background: flyerColor || previewCat.color } }),
              React.createElement("div", { className: "body" },
                React.createElement("div", { className: "stamp-meta" }, previewUni),
                React.createElement(CatTag, { cat: previewCat }),
                React.createElement("h3", null, title.trim() || "Your project"),
                React.createElement("p", { className: "blurb" }, tagline.trim() || "A short pitch — what is it, who is it for, why now."),
                openTitles.length > 0 && React.createElement("div", { className: "looking" },
                  React.createElement("span", { className: "role", style: { borderStyle: "solid", background: "transparent", borderColor: "transparent", paddingLeft: 0, color: "var(--ink-faint)" } }, "looking for:"),
                  openTitles.map((t, i) => React.createElement("span", { className: "role", key: i }, t))
                ),
                React.createElement("div", { className: "meta" },
                  React.createElement("div", { className: "joined-by" },
                    React.createElement(Facepile, { names: [profile && profile.username ? profile.username : "you"], extra: 0 }),
                    React.createElement("span", { className: "txt" }, openCount === 0
                      ? "Lead pinned"
                      : openCount + " role" + (openCount === 1 ? "" : "s") + " open")
                  )
                )
              )
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "How does it stick?"),
            React.createElement("div", { className: "pin-style-picker" },
              PIN_STYLES.map((s) => {
                const on = pinType === s.id;
                return React.createElement("button", {
                  key: s.id,
                  type: "button",
                  className: "ps-card" + (on ? " on" : ""),
                  onClick: () => setPinType(s.id),
                },
                  React.createElement("div", { className: "ps-preview ps-" + s.id },
                    s.id === "tape"
                      ? [
                          React.createElement("span", { key: "l", className: "ps-tape left" }),
                          React.createElement("span", { key: "r", className: "ps-tape right" }),
                        ]
                      : React.createElement(Pin, { className: "ps-pin" })
                  ),
                  React.createElement("b", null, s.label),
                  React.createElement("small", null, s.note)
                );
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Flyer head color"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
              React.createElement("input", {
                type: "color",
                value: flyerColor || CAT_HEX[cat] || "#cf5c3a",
                onChange: (e) => setFlyerColor(e.target.value),
                title: "Color of the strip across the top of your flyer",
                style: { width: 54, height: 38, padding: 2, border: "1.5px solid var(--paper-edge)", borderRadius: 8, background: "var(--paper)", cursor: "pointer" },
              }),
              flyerColor
                ? React.createElement("button", { type: "button", className: "ghost-link", style: { fontSize: 13 }, onClick: () => setFlyerColor("") },
                    React.createElement(Icon, { name: "x", size: 13 }), "Use category color")
                : React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)" } }, "// defaults to your category color")
            ),
            React.createElement("div", { className: "hint" }, "// personalize the strip across the top of your flyer"),
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Team chat link ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "input-wrap" },
              React.createElement(Icon, { name: "link", size: 17 }),
              React.createElement("input", {
                placeholder: "https://discord.gg/your-server",
                value: commLink,
                onChange: (e) => setCommLink(e.target.value),
              })
            ),
            React.createElement("div", { className: "hint" }, "// Discord, Slack, anywhere your team hangs out")
          )
        )
      );
    }

    // Step dots — clickable in edit mode, passive in create mode.
    const dots = Array.from({ length: STEP_COUNT }).map((_, i) => {
      const cls = "dot" + (i < step ? " done" : i === step ? " cur" : "");
      if (editable) {
        return React.createElement("button", {
          key: i, type: "button", className: cls, onClick: () => jumpTo(i),
          title: "Jump to step " + (i + 1), "aria-label": "Step " + (i + 1),
          style: { border: 0, cursor: "pointer", padding: 0 },
        });
      }
      return React.createElement("span", { key: i, className: cls });
    });

    const onLastStep = step === STEP_COUNT - 1;
    const ctaDisabled = onLastStep ? !allValid : !canNext;

    return (
      React.createElement("div", { className: "onb" },
        aside ? aside(currentValues) : null,
        React.createElement("div", { className: "onb-main grain" },
          React.createElement("div", { className: "onb-card create" },
            React.createElement("div", { className: "onb-steps" }, dots),
            body,
            React.createElement("div", { className: "onb-actions" },
              step > 0
                ? React.createElement("button", { className: "ghost-link", onClick: back }, "← Back")
                : React.createElement("button", { className: "ghost-link", onClick: onCancel }, "← Cancel"),
              extraFooter ? React.createElement("span", { className: "extra-footer" }, extraFooter) : null,
              React.createElement("span", { className: "spacer" }),
              onLastStep
                ? React.createElement("button", {
                    className: "btn btn-primary",
                    disabled: ctaDisabled,
                    style: ctaDisabled ? { opacity: 0.4, pointerEvents: "none" } : {},
                    onClick: submit,
                  },
                    React.createElement(Icon, { name: cta.icon || "pin", size: 17, stroke: "var(--paper)" }),
                    cta.primary)
                : React.createElement("button", {
                    className: "btn btn-primary",
                    disabled: ctaDisabled,
                    style: ctaDisabled ? { opacity: 0.4, pointerEvents: "none" } : {},
                    onClick: next,
                  },
                    "Continue",
                    React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" }))
            )
          )
        )
      )
    );
  }

  export { ProjectForm, EMPTY_VALUES };
  export default ProjectForm;
