/* ============================================================
   NESTED NYC — Club applications (owner view)
   /dashboard/members — who applied to join, what they answered,
   Accept / Decline; the roster; the declined pile; a CSV of all of
   it. Data arrives from useClubs.loadApplicants (rows are
   org_memberships joined with public names). Presentational.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI } from './data'
import { Av } from './shared'
import { answersToCsv, formatAnswer } from './eventRsvp'
import { postTimeAgo } from './postAdapter'

  const { useState } = React;

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function ApplicantRow({ r, questions, pending, onDecide }) {
    const answered = questions.filter((q) => formatAnswer(q, (r.answers || {})[q.id]));
    return (
      React.createElement("div", { className: "app-row" + (pending ? "" : " " + r.status) },
        React.createElement("div", { className: "app-head" },
          React.createElement(Av, { name: r.name, img: r.avatar || null, size: 40 }),
          React.createElement("span", { className: "who" },
            React.createElement("b", null, r.name),
            React.createElement("small", null, [r.handle && r.name !== "@" + r.handle ? "@" + r.handle : null, r.uni && UNI[r.uni] ? UNI[r.uni].name : null,
              (pending ? "applied " : r.status === "accepted" ? "joined " : "declined ") + postTimeAgo(pending ? r.requestedAt : (r.decidedAt || r.requestedAt))].filter(Boolean).join(" · "))
          ),
          pending
            ? React.createElement("span", { className: "app-actions" },
                React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => onDecide(r.id, true) },
                  React.createElement(Icon, { name: "check", size: 14, stroke: "var(--paper)" }), "Accept"),
                React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => onDecide(r.id, false) },
                  React.createElement(Icon, { name: "x", size: 14 }), "Decline"))
            : React.createElement("span", { className: "pending" + (r.status === "accepted" ? " acc" : " rej") },
                React.createElement(Icon, { name: r.status === "accepted" ? "check" : "x", size: 13, stroke: "currentColor" }),
                r.status === "accepted" ? "Member" : "Declined")
        ),
        questions.length > 0 && React.createElement("dl", { className: "app-answers" },
          questions.map((q) => {
            const v = formatAnswer(q, (r.answers || {})[q.id]);
            return React.createElement(React.Fragment, { key: q.id },
              React.createElement("dt", null, q.prompt),
              React.createElement("dd", { className: v ? "" : "resp-blank" }, v || "—"));
          }),
          answered.length === 0 && null
        )
      )
    );
  }

  function OrgMembers({ org, state, onBack, onRetry, onDecide, onEditOrg }) {
    const [tab, setTab] = useState("pending");
    const questions = (org && Array.isArray(org.join_questions) ? org.join_questions : []).filter((q) => q && q.id);
    const rows = (state && state.rows) || [];
    const loading = !state || state.loading;
    const error = state && state.error;
    const pending = rows.filter((r) => r.status === "pending");
    const members = rows.filter((r) => r.status === "accepted");
    const declined = rows.filter((r) => r.status === "rejected");
    const list = tab === "pending" ? pending : tab === "members" ? members : declined;
    const slug = (s) => String(s || "club").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const EMPTY = {
      pending: ["No applications waiting", questions.length ? "When a student taps Join on your page, their answers land here." : "When a student taps Join on your page they show up here. Add questions in your org settings to ask them anything first."],
      members: ["No members yet", "Accept an application and they're on the roster."],
      declined: ["Nothing declined", "Applications you turn down collect here."],
    };

    return (
      React.createElement("div", { className: "discover resp" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Dashboard")
        ),
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Applications", org ? [" · ", React.createElement("em", { key: "t" }, org.name)] : null),
            React.createElement("p", { className: "sub" }, "Students who tapped Join on your page. Accept them onto the roster, or pass.")
          ),
          React.createElement("div", { className: "board-actions" },
            rows.length > 0 && React.createElement("button", { className: "btn btn-ghost", onClick: () => download("applications-" + slug(org && org.name) + ".csv", answersToCsv(questions, rows.map((r) => ({ ...r, submittedAt: r.requestedAt })), { whoLabel: "Applicant", whenLabel: "Applied" })) },
              React.createElement(Icon, { name: "download", size: 16 }), "Download CSV"),
            onEditOrg && React.createElement("button", { className: "btn btn-ghost", onClick: onEditOrg },
              React.createElement(Icon, { name: "pencil", size: 16 }), "Edit questions")
          )
        ),

        React.createElement("div", { className: "dash-tabs" },
          [["pending", "Pending", pending.length], ["members", "Members", members.length], ["declined", "Declined", declined.length]].map(([id, label, n]) => (
            React.createElement("button", { key: id, className: "chip-filter" + (tab === id ? " active" : ""), onClick: () => setTab(id) },
              React.createElement(Icon, { name: id === "pending" ? "clock" : id === "members" ? "users" : "x", size: 17 }), label,
              n > 0 && React.createElement("span", { className: "count" }, n))
          ))
        ),

        loading && React.createElement("div", { className: "org-empty" }, React.createElement("p", null, "Loading…")),
        !loading && error && React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("h3", null, "Couldn't load the applications"),
          React.createElement("p", null, "Something went wrong reaching Nested. Try again."),
          React.createElement("button", { className: "btn btn-primary", style: { marginTop: 18 }, onClick: onRetry },
            React.createElement(Icon, { name: "refresh", size: 16, stroke: "var(--paper)" }), "Try again")),
        !loading && !error && list.length === 0 && React.createElement("div", { className: "match-empty fade-up" },
          React.createElement("h3", null, EMPTY[tab][0]),
          React.createElement("p", null, EMPTY[tab][1])),
        !loading && !error && list.length > 0 && React.createElement("div", { className: "app-list" },
          list.map((r) => React.createElement(ApplicantRow, { key: r.id, r, questions, pending: tab === "pending", onDecide }))
        )
      )
    );
  }

  export { OrgMembers };
  export default OrgMembers;
