/* ============================================================
   NESTED NYC — Event RSVPs (host view)
   /dashboard/events/:id/rsvps — who's going and what they answered,
   one row per attendee, one column per question, plus a CSV
   download. Data arrives from useOrg.loadEventResponses (rows are
   registrations joined with event_rsvp_answers + public names).
   Presentational.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, formatEventDate } from './shared'
import { answersToCsv, formatAnswer } from './eventRsvp'
import { postTimeAgo } from './postAdapter'

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function EventResponses({ event, state, onBack, onRetry, onEditEvent }) {
    const questions = (event && Array.isArray(event.questions) ? event.questions : []).filter((q) => q && q.id);
    const rows = (state && state.rows) || [];
    const loading = !state || state.loading;
    const error = state && state.error;
    const d = event ? formatEventDate(event.date) : null;
    const answered = rows.filter((r) => r.answers && Object.keys(r.answers).length).length;
    const slug = (s) => String(s || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return (
      React.createElement("div", { className: "discover resp" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Dashboard")
        ),
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "RSVPs", event ? [" · ", React.createElement("em", { key: "t" }, event.title)] : null),
            React.createElement("p", { className: "sub" }, event
              ? [d.weekday, d.dateLabel, event.time, event.location].filter(Boolean).join(" · ")
              : "Loading the event…")
          ),
          React.createElement("div", { className: "board-actions" },
            rows.length > 0 && React.createElement("button", { className: "btn btn-ghost", onClick: () => download("rsvps-" + slug(event && event.title) + ".csv", answersToCsv(questions, rows)) },
              React.createElement(Icon, { name: "download", size: 16 }), "Download CSV"),
            event && onEditEvent && React.createElement("button", { className: "btn btn-ghost", onClick: () => onEditEvent(event.id) },
              React.createElement(Icon, { name: "pencil", size: 16 }), "Edit event")
          )
        ),

        React.createElement("div", { className: "resp-strip" },
          React.createElement("span", null, React.createElement("b", null, rows.length), rows.length === 1 ? " going" : " going"),
          questions.length > 0 && React.createElement("span", null, React.createElement("b", null, answered), " answered"),
          React.createElement("span", null, React.createElement("b", null, questions.length), questions.length === 1 ? " question" : " questions"),
          React.createElement("span", { className: "resp-note" }, "Only you and each attendee can see their answers.")
        ),

        loading && React.createElement("div", { className: "org-empty" }, React.createElement("p", null, "Loading…")),
        !loading && error && React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("h3", null, "Couldn't load the RSVPs"),
          React.createElement("p", null, "Something went wrong reaching Nested. Try again."),
          React.createElement("button", { className: "btn btn-primary", style: { marginTop: 18 }, onClick: onRetry },
            React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Try again")),
        !loading && !error && rows.length === 0 && React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("h3", null, "No RSVPs yet"),
          React.createElement("p", null, questions.length ? "When students RSVP they'll answer your questions here." : "When students RSVP they'll show up here. Add questions to the event to collect anything you need from them.")),
        !loading && !error && rows.length > 0 && React.createElement("div", { className: "resp-scroll" },
          React.createElement("table", { className: "resp-table" },
            React.createElement("thead", null,
              React.createElement("tr", null,
                React.createElement("th", null, "Attendee"),
                React.createElement("th", null, "RSVP'd"),
                questions.map((q) => React.createElement("th", { key: q.id }, q.prompt, q.required && React.createElement("span", { className: "resp-req" }, " *")))
              )
            ),
            React.createElement("tbody", null,
              rows.map((r) => (
                React.createElement("tr", { key: r.userId },
                  React.createElement("td", { className: "resp-who" },
                    React.createElement(Av, { name: r.name, img: r.avatar || null }),
                    React.createElement("span", null,
                      React.createElement("b", null, r.name),
                      r.handle && React.createElement("small", null, "@" + r.handle))),
                  React.createElement("td", { className: "resp-when" }, postTimeAgo(r.registeredAt)),
                  questions.map((q) => {
                    const v = formatAnswer(q, (r.answers || {})[q.id]);
                    return React.createElement("td", { key: q.id, className: v ? "" : "resp-blank" }, v || "—");
                  })
                )
              ))
            )
          )
        )
      )
    );
  }

  export { EventResponses };
  export default EventResponses;
