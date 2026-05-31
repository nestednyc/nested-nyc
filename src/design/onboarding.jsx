/* ============================================================
   NESTED NYC — Onboarding flow
   email (.edu) → verify (stamp) → username → major+uni → interests
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNIVERSITIES, UNI, MAJORS, INTERESTS } from './data'
import { Stamp, Av } from './shared'

  const { useState, useRef, useEffect } = React;

  const STEP_COUNT = 5;

  function detectUni(email) {
    const at = email.split("@")[1] || "";
    const u = UNIVERSITIES.find((x) => at.endsWith(x.domain));
    return u || null;
  }

  function Onboarding({ onComplete }) {
    const [step, setStep] = useState(0);
    const [email, setEmail] = useState("");
    const [touched, setTouched] = useState(false);
    const [code, setCode] = useState(["", "", "", ""]);
    const [username, setUsername] = useState("");
    const [uni, setUni] = useState(null);
    const [major, setMajor] = useState("");
    const [interests, setInterests] = useState([]);
    const codeRefs = [useRef(), useRef(), useRef(), useRef()];

    const isEdu = /@[^@]+\.edu$/.test(email.trim());
    const detected = detectUni(email.trim());

    function next() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); setTouched(false); }
    function back() { setStep((s) => Math.max(s - 1, 0)); }

    // when arriving at uni step, preselect detected
    useEffect(() => { if (step === 3 && detected && !uni) setUni(detected.id); }, [step]);

    function setCodeDigit(i, v) {
      v = v.replace(/\D/g, "").slice(-1);
      const nc = [...code]; nc[i] = v; setCode(nc);
      if (v && i < 3) codeRefs[i + 1].current && codeRefs[i + 1].current.focus();
    }
    const codeFull = code.every((c) => c !== "");
    const usernameOk = username.trim().length >= 3 && /^[a-z0-9_.]+$/.test(username.trim());

    function finish() {
      onComplete({
        username: username.trim() || "student",
        uni: uni || (detected && detected.id) || "nyu",
        major: major || "Undeclared",
        interests,
        email: email.trim(),
      });
    }

    // ---------- step bodies ----------
    let body;
    if (step === 0) {
      const cls = !touched || email === "" ? "" : isEdu ? "good" : "bad";
      body = (
        React.createElement("div", { className: "fade-up", key: "s0" },
          React.createElement("span", { className: "onb-kicker" }, "Step 1 · The .edu gate"),
          React.createElement("h1", null, "Claim your spot."),
          React.createElement("p", { className: "desc" }, "Nested is students only. Drop your university email — we use the ", React.createElement("b", null, ".edu"), " to keep this a closed, peer-only space. No recruiters, no randoms."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "University email"),
            React.createElement("div", { className: "input-wrap " + cls },
              React.createElement(Icon, { name: "user", size: 19 }),
              React.createElement("input", {
                type: "email", placeholder: "you@nyu.edu", value: email, autoFocus: true,
                onChange: (e) => { setEmail(e.target.value); setTouched(true); },
                onKeyDown: (e) => { if (e.key === "Enter" && isEdu) next(); },
              }),
              detected && React.createElement("span", { className: "suffix", style: { color: "var(--c-side)" } }, detected.name)
            ),
            touched && email && !isEdu
              ? React.createElement("div", { className: "hint err" }, "// must be a .edu address")
              : detected
                ? React.createElement("div", { className: "hint ok" }, "// recognized — " + detected.full)
                : React.createElement("div", { className: "hint" }, "// NYU · Columbia · Cooper · Parsons · CUNY · Fordham …")
          )
        )
      );
    } else if (step === 1) {
      body = (
        React.createElement("div", { className: "fade-up", key: "s1" },
          React.createElement("span", { className: "onb-kicker" }, "Step 2 · Verify"),
          React.createElement("h1", null, "Check your inbox."),
          React.createElement("p", { className: "desc" }, "We sent a 4-digit code to ", React.createElement("b", null, email || "your email"), ". Enter it to get your verified stamp. ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--ink-faint)" } }, "(demo: type anything)")),
          React.createElement("div", { className: "field" },
            React.createElement("div", { className: "code-row" },
              code.map((c, i) => React.createElement("input", {
                key: i, ref: codeRefs[i], value: c, inputMode: "numeric", maxLength: 1, autoFocus: i === 0,
                onChange: (e) => setCodeDigit(i, e.target.value),
                onKeyDown: (e) => { if (e.key === "Backspace" && !c && i > 0) codeRefs[i - 1].current.focus(); if (e.key === "Enter" && codeFull) next(); },
              }))
            ),
            React.createElement("div", { className: "hint" }, "// didn't get it? resend in 0:30")
          )
        )
      );
    } else if (step === 2) {
      body = (
        React.createElement("div", { className: "fade-up", key: "s2" },
          React.createElement("div", { className: "stamp-stage", style: { paddingBottom: 6 } },
            React.createElement(Stamp, { size: 120, className: "stamp-big", style: { width: 120, height: 120 } })
          ),
          React.createElement("span", { className: "onb-kicker" }, "Step 3 · Your handle"),
          React.createElement("h1", null, "Pick a username."),
          React.createElement("p", { className: "desc" }, "This is how teammates find and @ you. Lowercase, letters, numbers, ", React.createElement("code", { style: { fontFamily: "var(--mono)" } }, "_ ."), " — you can change it later."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Username"),
            React.createElement("div", { className: "input-wrap " + (username && (usernameOk ? "good" : "bad")) },
              React.createElement("span", { className: "at" }, "@"),
              React.createElement("input", {
                placeholder: "maya.builds", value: username, autoFocus: true,
                onChange: (e) => setUsername(e.target.value.toLowerCase()),
                onKeyDown: (e) => { if (e.key === "Enter" && usernameOk) next(); },
              }),
              usernameOk && React.createElement(Icon, { name: "check", size: 18, stroke: "var(--c-side)" })
            ),
            username && !usernameOk
              ? React.createElement("div", { className: "hint err" }, "// 3+ chars, lowercase letters/numbers/_/. only")
              : usernameOk
                ? React.createElement("div", { className: "hint ok" }, "// @" + username.trim() + " is available")
                : React.createElement("div", { className: "hint" }, "// at least 3 characters")
          )
        )
      );
    } else if (step === 3) {
      body = (
        React.createElement("div", { className: "fade-up", key: "s3" },
          React.createElement("span", { className: "onb-kicker" }, "Step 4 · Where & what"),
          React.createElement("h1", null, "Where do you study?"),
          React.createElement("p", { className: "desc" }, "We pre-filled this from your email. Confirm your campus and add your major so projects can signal fit."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Campus"),
            React.createElement("div", { className: "uni-list" },
              UNIVERSITIES.map((u) => (
                React.createElement("button", {
                  key: u.id, className: "uni-opt" + (uni === u.id ? " on" : ""), onClick: () => setUni(u.id),
                },
                  React.createElement("span", { className: "seal", style: { background: u.color } }, u.name[0]),
                  React.createElement("span", null,
                    React.createElement("b", null, u.name),
                    React.createElement("small", null, u.domain)
                  )
                )
              ))
            )
          ),
          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Major"),
            React.createElement("div", { className: "chips-grid" },
              MAJORS.map((m) => (
                React.createElement("button", { key: m, className: "pick" + (major === m ? " on accent" : ""), onClick: () => setMajor(m) }, m)
              ))
            )
          )
        )
      );
    } else {
      body = (
        React.createElement("div", { className: "fade-up", key: "s4" },
          React.createElement("span", { className: "onb-kicker" }, "Step 5 · Interests"),
          React.createElement("h1", null, "What are you into?"),
          React.createElement("p", { className: "desc" }, "Pick a few — we'll surface projects that match. ", React.createElement("b", null, interests.length + " selected"), interests.length < 3 ? " · choose at least 3" : " · nice."),
          React.createElement("div", { className: "field" },
            React.createElement("div", { className: "chips-grid" },
              INTERESTS.map((it) => {
                const on = interests.includes(it);
                return React.createElement("button", {
                  key: it, className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setInterests((arr) => on ? arr.filter((x) => x !== it) : [...arr, it]),
                },
                  on && React.createElement(Icon, { name: "check", size: 14, width: 2.4 }),
                  it
                );
              })
            )
          )
        )
      );
    }

    // ---------- gating ----------
    const canNext = [isEdu, codeFull, usernameOk, !!uni && !!major, interests.length >= 3][step];

    return (
      React.createElement("div", { className: "onb" },
        // aside
        React.createElement("div", { className: "onb-aside corkbg grain" },
          React.createElement("div", { className: "a-top" },
            React.createElement("div", { className: "brand" },
              React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            )
          ),
          React.createElement("div", { className: "onb-pitch" },
            React.createElement("h2", null, "Find your people", React.createElement("br"), "for the thing", React.createElement("br"), "you're building."),
            React.createElement("p", null, "Startups, class projects, hackathon teams, research, side quests — the student-built layer for whatever you're making in NYC."),
            React.createElement("div", { className: "onb-mini-board" },
              React.createElement("div", { className: "mini-flyer", style: { transform: "rotate(-3deg)" } },
                React.createElement("div", { className: "cat-bar", style: { background: "var(--c-hack)" } }),
                React.createElement("b", null, "Subway Pulse"), React.createElement("small", null, "Cooper · hackathon")
              ),
              React.createElement("div", { className: "mini-flyer", style: { transform: "rotate(2.5deg)", marginTop: 14 } },
                React.createElement("div", { className: "cat-bar", style: { background: "var(--c-startup)" } }),
                React.createElement("b", null, "Loop"), React.createElement("small", null, "NYU · startup")
              )
            )
          )
        ),
        // main
        React.createElement("div", { className: "onb-main grain" },
          React.createElement("div", { className: "onb-card" },
            React.createElement("div", { className: "onb-steps" },
              Array.from({ length: STEP_COUNT }).map((_, i) => (
                React.createElement("span", { key: i, className: "dot" + (i < step ? " done" : i === step ? " cur" : "") })
              ))
            ),
            body,
            React.createElement("div", { className: "onb-actions" },
              step > 0 && React.createElement("button", { className: "ghost-link", onClick: back }, "← Back"),
              React.createElement("span", { className: "spacer" }),
              step < STEP_COUNT - 1
                ? React.createElement("button", { className: "btn btn-primary", disabled: !canNext, style: !canNext ? { opacity: .4, pointerEvents: "none" } : {}, onClick: next },
                    "Continue", React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" }))
                : React.createElement("button", { className: "btn btn-primary", disabled: !canNext, style: !canNext ? { opacity: .4, pointerEvents: "none" } : {}, onClick: finish },
                    "Enter Nested", React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" }))
            )
          )
        )
      )
    );
  }

  export { Onboarding };
  export default Onboarding;
