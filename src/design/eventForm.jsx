/* ============================================================
   NESTED NYC — Event form (Pin an event / Edit an event)
   3-step body — basics → when&where → preview — mirroring orgForm.jsx.
   Used by both create (from the org dashboard) and edit (from an
   event card on the dashboard). Submits a row shape compatible with
   eventService.createEvent / updateEvent.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { EVENT_TYPES, ETYPE, INTERESTS } from './data'
import { CatTag, formatEventDate } from './shared'

  const { useState } = React;

  const STEP_COUNT = 3;

  const EMPTY = {
    title: '',
    event_type: '',
    description: '',
    tags: [],
    date: '',
    time: '',
    duration: '',
    location: '',
    address: '',
    max_attendees: '',
  };

  function EventPreviewCard({ values, org }) {
    const ty = ETYPE[values.event_type] || ETYPE.talk;
    const d = formatEventDate(values.date);
    const blurb = (values.description || '').trim() || 'A one-line hook — what is this and who is it for?';
    return (
      React.createElement("article", { className: "ev-card grain", style: { "--rot": "-1.5deg" } },
        React.createElement("div", { className: "ev-date" },
          React.createElement("div", { className: "mon" }, d.mon),
          React.createElement("div", { className: "day" }, d.day),
          React.createElement("div", { className: "wd" }, d.weekday)
        ),
        React.createElement("div", { className: "ev-main" },
          React.createElement("div", { className: "ev-top" },
            React.createElement(CatTag, { cat: ty }),
            React.createElement("span", { className: "ev-host" }, (org && org.name) || "Your org")
          ),
          React.createElement("h3", null, (values.title || '').trim() || "Your event title"),
          React.createElement("p", { className: "ev-blurb" }, blurb),
          React.createElement("div", { className: "ev-meta" },
            React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "clock", size: 15 }), values.time || "Time"),
            React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "map", size: 15 }), values.location || "Location")
          )
        )
      )
    );
  }

  function EventForm({
    mode = 'create',
    org,
    initialValues,
    onSubmit,
    onCancel,
    submitting,
  }) {
    const init = { ...EMPTY, ...(initialValues || {}) };
    const [step, setStep] = useState(0);
    const [title, setTitle] = useState(init.title);
    const [eventType, setEventType] = useState(init.event_type);
    const [description, setDescription] = useState(init.description);
    const [tags, setTags] = useState(init.tags || []);
    const [date, setDate] = useState(init.date);
    const [time, setTime] = useState(init.time);
    const [duration, setDuration] = useState(init.duration);
    const [location, setLocation] = useState(init.location);
    const [address, setAddress] = useState(init.address);
    const [maxAttendees, setMaxAttendees] = useState(init.max_attendees || '');

    const editable = mode === 'edit';
    const cta = editable ? { primary: "Save changes", icon: "check" } : { primary: "Pin it", icon: "check" };

    function toggleTag(t) {
      setTags((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]);
    }
    function next() { setStep((s) => Math.min(s + 1, STEP_COUNT - 1)); }
    function back() { setStep((s) => Math.max(s - 1, 0)); }
    function jumpTo(i) { if (editable) setStep(i); }

    // Date must be today or future; DB's CHECK on date prevents past-date inserts.
    const todayIso = new Date().toISOString().slice(0, 10);
    const dateInFuture = !!date && date >= todayIso;
    const dateMissing = !date;
    const dateInPast = !!date && !dateInFuture;

    const stepGates = [
      !!title.trim() && !!eventType && !!description.trim(),
      dateInFuture && !!time.trim() && !!location.trim(),
      true,
    ];
    const canNext = stepGates[step];
    const allValid = stepGates.slice(0, STEP_COUNT - 1).every(Boolean);
    const values = { title, event_type: eventType, description, tags, date, time, duration, location, address, max_attendees: maxAttendees };

    function submit() {
      if (!allValid) return;
      const cap = parseInt(maxAttendees, 10);
      onSubmit({
        title: title.trim(),
        event_type: eventType,
        description: description.trim(),
        tags,
        date,
        time: time.trim(),
        location: location.trim(),
        address: address.trim() || null,
        max_attendees: Number.isFinite(cap) && cap > 0 ? cap : null,
        is_past: false,
        organizer_name: (org && org.name) || null,
        organizer_image: (org && org.logo) || null,
        // organization_id is added by the caller (orgDashboard) so this form
        // stays org-agnostic and can be reused if we ever support multi-org.
      });
    }

    let body;
    if (step === 0) {
      body = (
        React.createElement("div", { className: "fade-up", key: "ev0" },
          React.createElement("span", { className: "onb-kicker" }, "Step 1 · The basics"),
          React.createElement("h1", null, "What's the event?"),
          React.createElement("p", { className: "desc" }, "A title, the kind of event, and one line that tells students why to show up."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Event title"),
            React.createElement("div", { className: "input-wrap" + (title.trim() ? " good" : "") },
              React.createElement(Icon, { name: "flag", size: 17 }),
              React.createElement("input", {
                placeholder: "Spring AI Kickoff Night",
                value: title,
                maxLength: 80,
                autoFocus: true,
                onChange: (e) => setTitle(e.target.value),
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Type of event"),
            React.createElement("div", { className: "chips-grid" },
              EVENT_TYPES.map((t) => {
                const on = eventType === t.id;
                return React.createElement("button", {
                  key: t.id,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setEventType(t.id),
                },
                  React.createElement(Icon, { name: t.icon, size: 14, stroke: on ? "var(--paper)" : t.color }),
                  t.label);
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "One-line hook"),
            React.createElement("textarea", {
              className: "ta",
              placeholder: "Lightning talks from students shipping AI projects this semester.",
              value: description,
              rows: 3,
              maxLength: 240,
              onChange: (e) => setDescription(e.target.value),
            }),
            React.createElement("div", { className: "hint" }, "// " + description.length + " / 240")
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Tags ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "chips-grid" },
              INTERESTS.map((t) => {
                const on = tags.includes(t);
                return React.createElement("button", {
                  key: t,
                  className: "pick" + (on ? " on accent" : ""),
                  onClick: () => toggleTag(t),
                }, t);
              })
            )
          )
        )
      );
    } else if (step === 1) {
      body = (
        React.createElement("div", { className: "fade-up", key: "ev1" },
          React.createElement("span", { className: "onb-kicker" }, "Step 2 · When & where"),
          React.createElement("h1", null, "Lock in the details."),
          React.createElement("p", { className: "desc" }, "Date, time, place. We'll show this on the shared NYC calendar."),

          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Date"),
            React.createElement("div", { className: "input-wrap" + (dateInFuture ? " good" : "") },
              React.createElement(Icon, { name: "calendar", size: 17 }),
              React.createElement("input", {
                type: "date",
                min: todayIso,
                value: date,
                onChange: (e) => setDate(e.target.value),
              })
            ),
            dateInPast && React.createElement("div", { className: "hint", style: { color: "var(--c-startup)" } }, "// pick a date today or later"),
            dateMissing && date !== '' && React.createElement("div", { className: "hint" }, "// today: " + todayIso)
          ),

          React.createElement("div", { className: "form-2col", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 } },
            React.createElement("div", { className: "field" },
              React.createElement("label", null, "Start time"),
              React.createElement("div", { className: "input-wrap" + (time.trim() ? " good" : "") },
                React.createElement(Icon, { name: "clock", size: 17 }),
                React.createElement("input", {
                  placeholder: "6:00 PM",
                  value: time,
                  onChange: (e) => setTime(e.target.value),
                })
              )
            ),
            React.createElement("div", { className: "field" },
              React.createElement("label", null, "Duration ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
              React.createElement("div", { className: "input-wrap" },
                React.createElement(Icon, { name: "clock", size: 17 }),
                React.createElement("input", {
                  placeholder: "2 hours",
                  value: duration,
                  onChange: (e) => setDuration(e.target.value),
                })
              )
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Venue"),
            React.createElement("div", { className: "input-wrap" + (location.trim() ? " good" : "") },
              React.createElement(Icon, { name: "map", size: 17 }),
              React.createElement("input", {
                placeholder: "NYU Tandon — Rogers Hall",
                value: location,
                onChange: (e) => setLocation(e.target.value),
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Street address ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "input-wrap" },
              React.createElement(Icon, { name: "map", size: 17 }),
              React.createElement("input", {
                placeholder: "6 MetroTech Center, Brooklyn, NY",
                value: address,
                onChange: (e) => setAddress(e.target.value),
              })
            )
          ),

          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Capacity ", React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", fontWeight: 400 } }, "· optional")),
            React.createElement("div", { className: "input-wrap" },
              React.createElement(Icon, { name: "users", size: 17 }),
              React.createElement("input", {
                type: "number",
                min: "1",
                placeholder: "120",
                value: maxAttendees,
                onChange: (e) => setMaxAttendees(e.target.value),
              })
            )
          )
        )
      );
    } else {
      body = (
        React.createElement("div", { className: "fade-up", key: "ev2" },
          React.createElement("span", { className: "onb-kicker" }, editable ? "Step 3 · Save it" : "Step 3 · Pin it"),
          React.createElement("h1", null, editable ? "Ready to save?" : "Ready to pin it?"),
          React.createElement("p", { className: "desc" }, editable
            ? "Here's how your event reads on the shared calendar. Save your changes — they go live right away."
            : "Here's how it'll show up on the shared calendar. Pin it and students across NYC can RSVP."),

          React.createElement("div", { className: "create-preview-wrap" },
            React.createElement(EventPreviewCard, { values, org })
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

    const onLast = step === STEP_COUNT - 1;
    const ctaDisabled = onLast ? !allValid : !canNext;

    function aside() {
      return (
        React.createElement("div", { className: "onb-aside corkbg grain" },
          React.createElement("div", { className: "a-top" },
            React.createElement("div", { className: "brand" },
              React.createElement("span", { className: "mark" }, "N"),
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            ),
            React.createElement("button", { className: "ghost-link", onClick: onCancel, style: { fontSize: 13 } },
              React.createElement(Icon, { name: "arrowLeft", size: 14 }), editable ? "Back to dashboard" : "Cancel")
          ),
          React.createElement("div", { className: "onb-pitch" },
            React.createElement("h2", null, editable ? "Edit your" : "Pin your", React.createElement("br"), editable ? "event." : "next event."),
            React.createElement("p", null, "Three quick steps — basics, when & where, then a preview. Students see it on the shared NYC calendar the moment you pin it."),
            React.createElement("div", { className: "onb-mini-board" },
              React.createElement(EventPreviewCard, { values, org })
            )
          )
        )
      );
    }

    return (
      React.createElement("div", { className: "onb" },
        aside(),
        React.createElement("div", { className: "onb-main grain" },
          React.createElement("div", { className: "onb-card create" },
            React.createElement("div", { className: "onb-steps" }, dots),
            body,
            React.createElement("div", { className: "onb-actions" },
              step > 0
                ? React.createElement("button", { className: "ghost-link", onClick: back }, "← Back")
                : React.createElement("button", { className: "ghost-link", onClick: onCancel }, "← Cancel"),
              React.createElement("span", { className: "spacer" }),
              onLast
                ? React.createElement("button", {
                    className: "btn btn-primary",
                    disabled: ctaDisabled || submitting,
                    style: (ctaDisabled || submitting) ? { opacity: 0.4, pointerEvents: "none" } : {},
                    onClick: submit,
                  },
                    React.createElement(Icon, { name: cta.icon, size: 17, stroke: "var(--paper)" }),
                    submitting ? "Saving…" : cta.primary)
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

  export { EventForm, EventPreviewCard, EMPTY };
  export default EventForm;
