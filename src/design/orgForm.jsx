/* ============================================================
   NESTED NYC — Org form (shared 3-step body for "Pin your org")
   identity → brand → pin it
   Mirrors projectForm.jsx: same .onb shell, step dots, aside
   render-prop for a live preview, gate-per-step validation.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ORG_TYPES, UNIVERSITIES, UNI } from './data'
import { Av, Stamp, UniLogo } from './shared'
import { slugify, validateSlug } from '../services/orgService'

  const { useState } = React;

  const STEP_COUNT = 3;

  const EMPTY_VALUES = {
    name: "",
    slug: "",
    type: "",
    uni: "",
    bio: "",
    location: "",
    website: "",
    instagram: "",
  };

  // Compact org card used in the step-3 preview (and mirrored in the aside).
  function OrgPreview({ name, type, uni, bio }) {
    const uniName = uni && UNI[uni] ? UNI[uni].name : null;
    const typeLabel = type ? (ORG_TYPES.find((t) => t.id === type) || {}).label : "Organization";
    const sub = [typeLabel, uniName].filter(Boolean).join(" · ");
    return (
      React.createElement("article", { className: "org-mini grain", style: { "--rot": "-1.5deg" } },
        React.createElement("span", { className: "tape left" }),
        React.createElement("span", { className: "tape right" }),
        React.createElement("div", { className: "org-mini-head" },
          React.createElement(Av, { name: name && name.trim() ? name : "New Org", size: 46 }),
          React.createElement("div", { className: "org-mini-id" },
            React.createElement("b", null, (name || "").trim() || "Your organization"),
            React.createElement("small", null, sub)
          )
        ),
        React.createElement("p", { className: "org-mini-bio" }, (bio || "").trim() || "A one-line description of who you are and what you host."),
        React.createElement("div", { className: "org-mini-foot" },
          React.createElement("span", { className: "pending-chip" },
            React.createElement(Icon, { name: "clock", size: 12, stroke: "currentColor" }), "Pending .edu review")
        )
      )
    );
  }

  function OrgForm({
    mode = "create",
    initialValues,
    profile,
    aside,
    ctaCopy,
    onSubmit,
    onCancel,
    existingIds,
    extraFooter,
  }) {
    const init = { ...EMPTY_VALUES, ...(initialValues || {}) };

    const [step, setStep] = useState(0);
    const [name, setName] = useState(init.name);
    const [slug, setSlug] = useState(init.slug);
    const [slugTouched, setSlugTouched] = useState(!!init.slug);
    const [type, setType] = useState(init.type);
    const [uni, setUni] = useState(init.uni || (profile && profile.uni) || "");
    const [bio, setBio] = useState(init.bio);
    const [location, setLocation] = useState(init.location);
    const [website, setWebsite] = useState(init.website);
    const [instagram, setInstagram] = useState(init.instagram);

    const editable = mode === "edit";
    const cta = ctaCopy || { primary: "Pin your org", icon: "pin" };

    // Slug auto-suggests from the name until edited. validateSlug + slugify are
    // the SAME helpers orgService uses on insert, so the form enforces exactly
    // what the DB CHECK accepts (3–32 chars, a-z0-9-, no edge hyphens, reserved
    // words blocked). Phase 2 swaps the local create for orgService.createOrg.
    const effSlug = (slugTouched ? slug : slugify(name)) || "";
    const slugErr = effSlug ? validateSlug(effSlug) : null;
    const slugTaken = !!(existingIds && effSlug && existingIds.has(effSlug) && effSlug !== init.slug);

    function setSlugManual(v) {
      setSlugTouched(true);
      setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
    }

    function next() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); }
    function back() { setStep((s) => Math.max(s - 1, 0)); }
    function jumpTo(i) { if (editable) setStep(i); }

    // uni is required for clubs, optional for "other", N/A for a university.
    const needsUni = type === "club";
    const showUni = type && type !== "university";

    const stepGates = [
      !!name.trim() && !!effSlug && !slugErr && !slugTaken && !!type && (!needsUni || !!uni),
      !!bio.trim() && !!location.trim(),
      true,
    ];
    const canNext = stepGates[step];
    const allValid = stepGates.slice(0, STEP_COUNT - 1).every(Boolean);

    function submit() {
      if (!allValid) return;
      onSubmit({
        name: name.trim(),
        slug: effSlug,
        type,
        uni: showUni ? uni : "",
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        instagram: instagram.replace(/^@/, "").trim(),
      });
    }

    const currentValues = { name, slug: effSlug, type, uni: showUni ? uni : "", bio, location, website, instagram };

    // ---------- step bodies ----------
    let body;
    if (step === 0) {
      body = (
        React.createElement("div", { className: "fade-up", key: "o0" },
          React.createElement("span", { className: "onb-kicker" }, "Step 1 · Identity"),
          React.createElement("h1", null, "Name your org."),
          React.createElement("p", { className: "desc" }, "What students will see at the top of your page — and the kind of org you are."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Organization name"),
            React.createElement("div", { className: "input-wrap" + (name && name.trim() ? " good" : "") },
              React.createElement(Icon, { name: "flag", size: 17 }),
              React.createElement("input", {
                placeholder: "NYU AI Collective",
                value: name,
                maxLength: 50,
                autoFocus: true,
                onChange: (e) => setName(e.target.value),
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Page link"),
            React.createElement("div", { className: "input-wrap slug-wrap" + (effSlug && !slugTaken && !slugErr ? " good" : "") },
              React.createElement("span", { className: "slug-prefix" }, "nested.app/orgs/"),
              React.createElement("input", {
                placeholder: "nyu-ai-collective",
                value: effSlug,
                onChange: (e) => setSlugManual(e.target.value),
              })
            ),
            React.createElement("div", { className: "hint" }, (slugTaken || slugErr)
              ? React.createElement("span", { style: { color: "var(--c-startup)" } }, "// " + (slugTaken ? "that link is taken — try another" : slugErr.toLowerCase()))
              : "// auto-filled from your name · edit if you like")
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "What kind of org?"),
            React.createElement("div", { className: "chips-grid" },
              ORG_TYPES.map((t) => {
                const on = type === t.id;
                return React.createElement("button", {
                  key: t.id,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setType(t.id),
                  title: t.note,
                }, t.label);
              })
            )
          ),

          showUni && React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, needsUni ? "Campus" : "Home campus ",
              !needsUni && React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "chips-grid" },
              UNIVERSITIES.map((u) => {
                const on = uni === u.id;
                return React.createElement("button", {
                  key: u.id,
                  className: "pick" + (on ? " on accent" : ""),
                  style: { gap: 8 },
                  onClick: () => setUni(on && !needsUni ? "" : u.id),
                }, React.createElement(UniLogo, { uni: u, size: 20, radius: 5 }), u.name);
              })
            )
          )
        )
      );
    } else if (step === 1) {
      body = (
        React.createElement("div", { className: "fade-up", key: "o1" },
          React.createElement("span", { className: "onb-kicker" }, "Step 2 · The page"),
          React.createElement("h1", null, "Tell students who you are."),
          React.createElement("p", { className: "desc" }, "A short bio and where to find you. This is the social hook on your org page."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Bio"),
            React.createElement("textarea", {
              className: "ta",
              placeholder: "Who you are, what you host, and who should join. One or two lines.",
              value: bio,
              rows: 3,
              maxLength: 240,
              autoFocus: true,
              onChange: (e) => setBio(e.target.value),
            }),
            React.createElement("div", { className: "hint" }, "// " + bio.length + " / 240")
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Based at"),
            React.createElement("div", { className: "input-wrap" + (location && location.trim() ? " good" : "") },
              React.createElement(Icon, { name: "map", size: 17 }),
              React.createElement("input", {
                placeholder: "NYU Tandon, Brooklyn",
                value: location,
                onChange: (e) => setLocation(e.target.value),
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Website ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "input-wrap" },
              React.createElement(Icon, { name: "globe", size: 17 }),
              React.createElement("input", {
                placeholder: "https://your-org.club",
                value: website,
                onChange: (e) => setWebsite(e.target.value),
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Instagram ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "input-wrap" },
              React.createElement(Icon, { name: "camera", size: 17 }),
              React.createElement("input", {
                placeholder: "your.org",
                value: instagram,
                onChange: (e) => setInstagram(e.target.value),
              })
            )
          )
        )
      );
    } else {
      body = (
        React.createElement("div", { className: "fade-up", key: "o2" },
          React.createElement("span", { className: "onb-kicker" }, editable ? "Step 3 · Save it" : "Step 3 · Pin it"),
          React.createElement("h1", null, editable ? "Ready to save?" : "Ready to go up?"),
          React.createElement("p", { className: "desc" }, editable
            ? "Here's your org page. Save your changes — you can keep editing later."
            : "Here's your org page. It goes up right away; the .edu stamp lands once we verify you (usually within a day)."),

          React.createElement("div", { className: "create-preview-wrap" },
            React.createElement(OrgPreview, { name, type, uni, bio })
          ),

          React.createElement("div", { className: "verify-note" },
            React.createElement(Stamp, { size: 52, label: "ORG" }),
            React.createElement("div", null,
              React.createElement("b", null, "About the .edu stamp"),
              React.createElement("p", null, "Verified orgs get the rubber stamp on their page and rank higher in Events. New orgs are live immediately and reviewed shortly after.")
            )
          )
        )
      );
    }

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

  export { OrgForm, OrgPreview, EMPTY_VALUES, slugify };
  export default OrgForm;
