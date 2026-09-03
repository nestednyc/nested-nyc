/* ============================================================
   NESTED NYC — Org form (shared 3-step body for "Pin your org")
   identity → brand → pin it
   Mirrors projectForm.jsx: same .onb shell, step dots, aside
   render-prop for a live preview, gate-per-step validation.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ORG_TYPES, UNIVERSITIES, cleanProjectLinks } from './data'
import { Av, UniLogo, OrgMini, LinkRows, linkRowsFrom, resizePhoto } from './shared'
import { QuestionBuilder, questionIssues, normalizeQuestions } from './eventRsvp'

  const { useState, useRef } = React;

  const STEP_COUNT = 4;

  const EMPTY_VALUES = {
    name: "",
    type: "",
    uni: "",
    bio: "",
    location: "",
    links: [],
    logo: "",
    joinQuestions: [],
    joinUrl: "",
  };

  // Step-3 preview / aside mirror — the shared org flyer rendered with the
  // in-progress draft (a student-founded club previews with its student-run label).
  function OrgPreview({ name, type, uni, bio, studentRun }) {
    return React.createElement(OrgMini, { name, type, uni, bio, studentRun: !!studentRun });
  }

  // variant: "org" (the org-email onboarding + edit) | "student" (a student
  // founding a club from inside the student app — type locked to "club",
  // the type chips hidden, campus prefilled from their profile, and the
  // copy says "live right away" because the DB stamps student_run).
  function OrgForm({
    mode = "create",
    variant = "org",
    initialValues,
    profile,
    aside,
    ctaCopy,
    onSubmit,
    onCancel,
    extraFooter,
  }) {
    const student = variant === "student";
    const init = { ...EMPTY_VALUES, ...(initialValues || {}), ...(student ? { type: "club" } : {}) };

    const [step, setStep] = useState(0);
    const [name, setName] = useState(init.name);
    const [type, setType] = useState(init.type);
    const [uni, setUni] = useState(init.uni || (profile && profile.uni) || "");
    const [bio, setBio] = useState(init.bio);
    const [location, setLocation] = useState(init.location);
    // Logo: a public URL (edit mode) or a freshly picked photo held as a
    // data: URL until the wrapper uploads it on save. "" = no logo.
    const [logo, setLogo] = useState(init.logo || "");
    const logoRef = useRef(null);
    // Links edit as raw strings (edit mode hands us {kind,url} rows); the
    // builder always shows ≥1 row and blanks drop on submit.
    const [links, setLinks] = useState(linkRowsFrom(init.links));
    // Membership: the questions students answer when they tap Join, and an
    // optional external sign-up link shown beside the button.
    const [joinQuestions, setJoinQuestions] = useState(Array.isArray(init.joinQuestions) ? init.joinQuestions : []);
    const [joinUrl, setJoinUrl] = useState(init.joinUrl || "");
    const qIssues = questionIssues(joinQuestions);
    const joinUrlOk = !joinUrl.trim() || /^https?:\/\/\S+$/i.test(joinUrl.trim());

    async function pickLogo(file) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
      try { setLogo(await resizePhoto(file, 400)); } catch { /* keep the old one */ }
    }

    const editable = mode === "edit";
    const cta = ctaCopy || { primary: "Pin your org", icon: "check" };

    function next() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); }
    function back() { setStep((s) => Math.max(s - 1, 0)); }
    function jumpTo(i) { if (editable) setStep(i); }

    // uni is required for clubs, optional for "other", N/A for a university.
    const needsUni = type === "club";
    const showUni = type && type !== "university";

    const joinable = type !== "university";
    const stepGates = [
      !!name.trim() && !!type && (!needsUni || !!uni),
      !!bio.trim() && !!location.trim(),
      !joinable || (qIssues.length === 0 && joinUrlOk),
      true,
    ];
    const canNext = stepGates[step];
    const allValid = stepGates.slice(0, STEP_COUNT - 1).every(Boolean);

    function submit() {
      if (!allValid) return;
      onSubmit({
        name: name.trim(),
        type,
        uni: showUni ? uni : "",
        bio: bio.trim(),
        location: location.trim(),
        // Store only {kind, url} — label/icon re-derive on read. Both the
        // onboard and edit wrappers inherit the strip from this one place.
        links: cleanProjectLinks(links).map(({ kind, url }) => ({ kind, url })),
        logo,
        joinQuestions: joinable ? normalizeQuestions(joinQuestions) : [],
        joinUrl: joinable && joinUrlOk ? joinUrl.trim() : "",
      });
    }

    const currentValues = { name, type, uni: showUni ? uni : "", bio, location, links, logo };

    // ---------- step bodies ----------
    let body;
    if (step === 0) {
      body = (
        React.createElement("div", { className: "fade-up", key: "o0" },
          React.createElement("span", { className: "onb-kicker" }, "Step 1 · Identity"),
          React.createElement("h1", null, student ? "Name your club." : "Name your org."),
          React.createElement("p", { className: "desc" }, student
            ? "What students will see at the top of your club's page — and which campus it calls home."
            : "What students will see at the top of your page — and the kind of org you are."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, student ? "Club name" : "Organization name"),
            React.createElement("div", { className: "input-wrap" + (name && name.trim() ? " good" : "") },
              React.createElement(Icon, { name: "flag", size: 17 }),
              React.createElement("input", {
                placeholder: student ? "Tandon Robotics Club" : "NYU AI Collective",
                value: name,
                maxLength: 50,
                autoFocus: true,
                onChange: (e) => setName(e.target.value),
              })
            )
          ),

          !student && React.createElement("div", { className: "field", style: { marginTop: 22 } },
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
          React.createElement("p", { className: "desc" }, "A logo, a short bio and where to find you. This is the social hook on your org page — and the face of every post you pin to the community board."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Logo ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional, square works best")),
            React.createElement("div", { className: "org-logo-pick" },
              React.createElement(Av, { name: name || "?", img: logo || null, size: 56 }),
              React.createElement("button", { className: "btn btn-ghost btn-sm", type: "button", onClick: () => logoRef.current && logoRef.current.click() },
                React.createElement(Icon, { name: "camera", size: 15 }), logo ? "Change logo" : "Upload logo"),
              logo && React.createElement("button", { className: "btn btn-ghost btn-sm", type: "button", onClick: () => setLogo("") }, "Remove"),
              React.createElement("input", {
                ref: logoRef, type: "file", accept: "image/*", style: { display: "none" },
                onChange: (e) => { pickLogo(e.target.files && e.target.files[0]); e.target.value = ""; },
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Bio"),
            React.createElement("textarea", {
              className: "ta",
              placeholder: "Who you are, what you host, and who should join. One or two lines.",
              value: bio,
              rows: 3,
              maxLength: 240,
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
            React.createElement("label", null, "Links ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement(LinkRows, {
              links, setLinks,
              placeholders: ["https://your-org.club", "@your.org"],
            }),
            React.createElement("div", { className: "hint" }, "// your site, @instagram, Discord, Linktree — students see these on your page")
          )
        )
      );
    } else if (step === 2) {
      body = (
        React.createElement("div", { className: "fade-up", key: "o-join" },
          React.createElement("span", { className: "onb-kicker" }, "Step 3 · Membership"),
          React.createElement("h1", null, joinable ? "Who gets in?" : "Membership"),
          joinable
            ? [
                React.createElement("p", { className: "desc", key: "d" }, "Students tap Join on your page and answer these; you accept or decline from your dashboard. Optional — with no questions they just apply."),
                React.createElement(QuestionBuilder, { key: "qb", questions: joinQuestions, onChange: setJoinQuestions }),
                qIssues.length > 0 && React.createElement("div", { key: "qi", className: "hint", style: { color: "var(--c-startup)", marginTop: 10 } }, "// " + qIssues[0]),
                React.createElement("div", { key: "url", className: "field", style: { marginTop: 22 } },
                  React.createElement("label", null, "Sign-up link ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
                  React.createElement("div", { className: "input-wrap" + (joinUrl.trim() && joinUrlOk ? " good" : "") },
                    React.createElement(Icon, { name: "link", size: 17 }),
                    React.createElement("input", { value: joinUrl, placeholder: "https://…  (Engage, a Google Form, your Discord)", maxLength: 500, onChange: (e) => setJoinUrl(e.target.value) })),
                  React.createElement("div", { className: "hint" }, joinUrlOk ? "// if you also collect sign-ups somewhere else, we'll link it next to Join" : "// needs to start with https://")),
              ]
            : React.createElement("p", { className: "desc" }, "A university page doesn't take members — students belong to it through their .edu. Nothing to set here.")
        )
      );
    } else {
      body = (
        React.createElement("div", { className: "fade-up", key: "o2" },
          React.createElement("span", { className: "onb-kicker" }, editable ? "Step 4 · Save it" : student ? "Step 4 · Start it" : "Step 4 · Pin it"),
          React.createElement("h1", null, editable ? "Ready to save?" : student ? "Ready to open the doors?" : "Ready to go up?"),
          React.createElement("p", { className: "desc" }, editable
            ? "Here's your org page. Save your changes — you can keep editing later."
            : student
              ? "Here's your club's page. It goes live the moment you pin it, labeled student-run — students can follow, join and RSVP right away."
              : "Here's your org page. It goes live the moment you pin it — students can follow it, join it and RSVP to what you host right away."),

          React.createElement("div", { className: "create-preview-wrap" },
            React.createElement(OrgPreview, { name, type, uni, bio, studentRun: student })
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
                    React.createElement(Icon, { name: cta.icon || "check", size: 17, stroke: "var(--paper)" }),
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

  export { OrgForm, OrgPreview, EMPTY_VALUES };
  export default OrgForm;
