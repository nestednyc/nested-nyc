/* ============================================================
   NESTED NYC — Event RSVP questions
   The host's question builder (inside the event form), the
   attendee's answer sheet (a modal that opens on "I'm going" when
   the event asks anything), and the CSV helper for the host's
   responses table. Pure presentational + pure helpers; state lives
   in useEvents / the event form. AnswerSheet is the generic modal
   body (questions in, answers out) — RsvpModal wraps it for events,
   clubJoin.jsx wraps it for club applications.

   Question shape (events.questions, migration 20260901000000):
     { id, prompt, type, options[], required }
     type ∈ short · long · choice · multi · date · yesno
   Answer shape (event_rsvp_answers.answers): { [id]: string | string[] }
   ============================================================ */
import React from 'react'
import Icon from './icons'

  const { useState } = React;

  const QUESTION_TYPES = [
    { id: "short",  label: "Short answer" },
    { id: "long",   label: "Paragraph" },
    { id: "choice", label: "Multiple choice" },
    { id: "multi",  label: "Checkboxes" },
    { id: "date",   label: "Date" },
    { id: "yesno",  label: "Yes / no" },
  ];
  const MAX_QUESTIONS = 10;
  const needsOptions = (t) => t === "choice" || t === "multi";

  function newQuestion() {
    return { id: "q_" + Math.random().toString(36).slice(2, 9), prompt: "", type: "short", options: [], required: false };
  }

  // What's wrong with a draft list, in order — the form gates on this.
  function questionIssues(list) {
    const issues = [];
    (list || []).forEach((q, i) => {
      const n = "Question " + (i + 1);
      if (!q.prompt || !q.prompt.trim()) issues.push(n + " needs a prompt");
      if (needsOptions(q.type) && (q.options || []).filter((o) => o && o.trim()).length < 2) issues.push(n + " needs at least two options");
    });
    if ((list || []).length > MAX_QUESTIONS) issues.push("At most " + MAX_QUESTIONS + " questions");
    return issues;
  }

  // Draft → the JSONB the DB stores (trimmed, options only where they apply).
  function normalizeQuestions(list) {
    return (list || []).slice(0, MAX_QUESTIONS).map((q) => ({
      id: q.id || newQuestion().id,
      prompt: (q.prompt || "").trim().slice(0, 200),
      type: QUESTION_TYPES.some((t) => t.id === q.type) ? q.type : "short",
      options: needsOptions(q.type) ? (q.options || []).map((o) => (o || "").trim()).filter(Boolean).slice(0, 12) : [],
      required: !!q.required,
    })).filter((q) => q.prompt);
  }

  // One answer, as a human reads it.
  function formatAnswer(q, v) {
    if (v === undefined || v === null || v === "") return "";
    if (Array.isArray(v)) return v.join("; ");
    if (q && q.type === "yesno") return v === "yes" ? "Yes" : v === "no" ? "No" : String(v);
    return String(v);
  }

  // Responses → CSV (Excel-safe: quoted cells, doubled quotes, CRLF).
  function answersToCsv(questions, rows, { whoLabel = "Attendee", whenLabel = "Submitted" } = {}) {
    const cell = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const head = [whoLabel, "Handle", whenLabel, ...(questions || []).map((q) => q.prompt)];
    const lines = [head.map(cell).join(",")];
    (rows || []).forEach((r) => {
      lines.push([
        r.name || "", r.handle ? "@" + r.handle : "", r.submittedAt || "",
        ...(questions || []).map((q) => formatAnswer(q, (r.answers || {})[q.id])),
      ].map(cell).join(","));
    });
    return lines.join("\r\n");
  }

  // ── The host's builder ────────────────────────────────────────────
  function QuestionBuilder({ questions, onChange }) {
    const list = questions || [];
    const patch = (i, delta) => onChange(list.map((q, j) => (j === i ? { ...q, ...delta } : q)));
    const remove = (i) => onChange(list.filter((_, j) => j !== i));
    const move = (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    return (
      React.createElement("div", { className: "qb" },
        list.map((q, i) => (
          React.createElement("div", { className: "qb-row", key: q.id },
            React.createElement("div", { className: "qb-head" },
              React.createElement("span", { className: "qb-n" }, String(i + 1).padStart(2, "0")),
              React.createElement("input", {
                className: "qb-prompt", placeholder: i === 0 ? "Any dietary restrictions?" : "Your question",
                value: q.prompt, maxLength: 200, autoFocus: !q.prompt,
                onChange: (e) => patch(i, { prompt: e.target.value }),
              }),
              React.createElement("select", { className: "qb-type", value: q.type, "aria-label": "Answer type", onChange: (e) => patch(i, { type: e.target.value }) },
                QUESTION_TYPES.map((t) => React.createElement("option", { key: t.id, value: t.id }, t.label))),
            ),
            needsOptions(q.type) && React.createElement("div", { className: "qb-options" },
              (q.options && q.options.length ? q.options : ["", ""]).map((o, k) => (
                React.createElement("div", { className: "qb-opt", key: k },
                  React.createElement(Icon, { name: q.type === "multi" ? "check" : "bolt", size: 12, stroke: "var(--ink-faint)" }),
                  React.createElement("input", {
                    placeholder: "Option " + (k + 1), value: o, maxLength: 80,
                    onChange: (e) => { const opts = [...(q.options && q.options.length ? q.options : ["", ""])]; opts[k] = e.target.value; patch(i, { options: opts }); },
                  }),
                  (q.options || []).length > 2 && React.createElement("button", { type: "button", className: "qb-x", "aria-label": "Remove option", onClick: () => patch(i, { options: q.options.filter((_, m) => m !== k) }) },
                    React.createElement(Icon, { name: "x", size: 12 }))
                )
              )),
              (q.options || []).length < 12 && React.createElement("button", { type: "button", className: "ghost-link qb-addopt", onClick: () => patch(i, { options: [...(q.options && q.options.length ? q.options : ["", ""]), ""] }) },
                React.createElement(Icon, { name: "plus", size: 13 }), "Add option")
            ),
            React.createElement("div", { className: "qb-foot" },
              React.createElement("button", { type: "button", className: "pick" + (q.required ? " on accent" : ""), "aria-pressed": q.required, onClick: () => patch(i, { required: !q.required }) },
                q.required && React.createElement(Icon, { name: "check", size: 13, width: 2.4 }), "Required"),
              React.createElement("span", { className: "spacer" }),
              React.createElement("button", { type: "button", className: "qb-ico", disabled: i === 0, "aria-label": "Move up", onClick: () => move(i, -1) }, "↑"),
              React.createElement("button", { type: "button", className: "qb-ico", disabled: i === list.length - 1, "aria-label": "Move down", onClick: () => move(i, 1) }, "↓"),
              React.createElement("button", { type: "button", className: "qb-ico danger", "aria-label": "Remove question", onClick: () => remove(i) },
                React.createElement(Icon, { name: "trash", size: 14 }))
            )
          )
        )),
        list.length < MAX_QUESTIONS && React.createElement("button", { type: "button", className: "btn btn-ghost qb-add", onClick: () => onChange([...list, newQuestion()]) },
          React.createElement(Icon, { name: "plus", size: 15 }), list.length ? "Add another question" : "Add a question"),
        list.length >= MAX_QUESTIONS && React.createElement("div", { className: "hint" }, "// " + MAX_QUESTIONS + " questions is the cap — keep it quick to fill in")
      )
    );
  }

  // ── The generic answer sheet ──────────────────────────────────────
  // A modal that asks `questions` and hands back { [id]: answer }. The
  // copy, accent and CTA are the caller's; validation is here.
  function AnswerSheet({ questions: qs, initial, submitting, error, title, lede, submitLabel, submittingLabel, submitIcon, accent, onCancel, onSubmit }) {
    const questions = (Array.isArray(qs) ? qs : []).filter((q) => q && q.id && q.prompt);
    const [answers, setAnswers] = useState(() => ({ ...(initial || {}) }));
    const [touched, setTouched] = useState(false);
    const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
    const toggleMulti = (id, opt) => setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? a[id] : [];
      return { ...a, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
    const isEmpty = (q) => {
      const v = answers[q.id];
      return q.type === "multi" ? !(Array.isArray(v) && v.length) : !(v !== undefined && v !== null && String(v).trim() !== "");
    };
    const missing = questions.filter((q) => q.required && isEmpty(q));
    function submit() {
      setTouched(true);
      if (missing.length || submitting) return;
      onSubmit(answers);
    }

    return (
      React.createElement("div", { className: "scrim", onClick: onCancel },
        React.createElement("div", { className: "modal rsvp-modal", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "cat-bar", style: { background: accent || "var(--c-research)" } }),
          React.createElement("button", { className: "modal-close", onClick: onCancel, "aria-label": "Close" }, React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("h2", null, title),
            React.createElement("p", null, lede),
            React.createElement("div", { className: "rsvp-form" },
              questions.map((q) => {
                const bad = touched && q.required && isEmpty(q);
                const v = answers[q.id];
                let control;
                if (q.type === "long") {
                  control = React.createElement("textarea", { className: "ta", rows: 3, maxLength: 1000, value: v || "", onChange: (e) => set(q.id, e.target.value) });
                } else if (q.type === "choice") {
                  control = React.createElement("div", { className: "chips-grid" },
                    (q.options || []).map((o) => React.createElement("button", { key: o, type: "button", className: "pick" + (v === o ? " on accent" : ""), "aria-pressed": v === o, onClick: () => set(q.id, o) }, o)));
                } else if (q.type === "multi") {
                  const cur = Array.isArray(v) ? v : [];
                  control = React.createElement("div", { className: "chips-grid" },
                    (q.options || []).map((o) => React.createElement("button", { key: o, type: "button", className: "pick" + (cur.includes(o) ? " on accent" : ""), "aria-pressed": cur.includes(o), onClick: () => toggleMulti(q.id, o) },
                      cur.includes(o) && React.createElement(Icon, { name: "check", size: 13, width: 2.4 }), o)));
                } else if (q.type === "yesno") {
                  control = React.createElement("div", { className: "chips-grid" },
                    [["yes", "Yes"], ["no", "No"]].map(([val, label]) => React.createElement("button", { key: val, type: "button", className: "pick" + (v === val ? " on accent" : ""), "aria-pressed": v === val, onClick: () => set(q.id, val) }, label)));
                } else if (q.type === "date") {
                  control = React.createElement("div", { className: "input-wrap" + (v ? " good" : "") },
                    React.createElement(Icon, { name: "calendar", size: 17 }),
                    React.createElement("input", { type: "date", value: v || "", onChange: (e) => set(q.id, e.target.value) }));
                } else {
                  control = React.createElement("div", { className: "input-wrap" + (v ? " good" : "") },
                    React.createElement(Icon, { name: "pencil", size: 17 }),
                    React.createElement("input", { value: v || "", maxLength: 300, onChange: (e) => set(q.id, e.target.value) }));
                }
                return React.createElement("div", { className: "field rsvp-q" + (bad ? " bad" : ""), key: q.id },
                  React.createElement("label", null, q.prompt, q.required && React.createElement("span", { className: "rsvp-req" }, " · required")),
                  control,
                  bad && React.createElement("div", { className: "hint", style: { color: "var(--c-startup)" } }, "// this one's required")
                );
              })
            ),
            error && React.createElement("div", { className: "hint", style: { color: "var(--c-startup)", marginTop: 12 } }, "// " + error),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onCancel }, "Cancel"),
              React.createElement("button", { className: "btn btn-primary", disabled: submitting, onClick: submit },
                React.createElement(Icon, { name: submitIcon || "plus", size: 16, stroke: "var(--paper)" }),
                submitting ? (submittingLabel || "Saving…") : submitLabel)
            )
          )
        )
      )
    );
  }

  // ── The attendee's answer sheet ───────────────────────────────────
  function RsvpModal({ event, initial, editing, submitting, error, onCancel, onSubmit }) {
    const questions = event && Array.isArray(event.questions) ? event.questions : [];
    const title = editing ? "Your answers" : "A few questions first";
    const lede = editing
      ? "Update what you told " + ((event && event.orgName) || "the host") + " — they see the latest."
      : ((event && event.orgName) || "The host") + " asks everyone going to " + ((event && event.title) || "this event") + ". Only they and you can see your answers.";
    return React.createElement(AnswerSheet, {
      questions, initial, submitting, error, title, lede,
      submitLabel: editing ? "Save answers" : "I'm going",
      submitIcon: editing ? "check" : "plus",
      accent: "var(--c-research)",
      onCancel, onSubmit,
    });
  }

  export { QUESTION_TYPES, MAX_QUESTIONS, newQuestion, questionIssues, normalizeQuestions, formatAnswer, answersToCsv, QuestionBuilder, AnswerSheet, RsvpModal };
  export default RsvpModal;
