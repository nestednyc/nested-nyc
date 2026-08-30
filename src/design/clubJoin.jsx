/* ============================================================
   NESTED NYC — Join a club
   The student's side of club membership: the Join pill (one
   control that reads none → Join · pending → Applied · accepted →
   Member · rejected → Apply again), the application sheet (the
   generic AnswerSheet asking the club's join_questions), and the
   public roster block for the club page. Presentational; state and
   handlers arrive from useClubs via the api bag.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI } from './data'
import { Av } from './shared'
import { AnswerSheet } from './eventRsvp'

  const ROSTER_SHOWN = 24;

  // membership: { id, status } | undefined
  function joinState(membership) {
    return membership && membership.status ? membership.status : "none";
  }

  function JoinPill({ membership, small, onClick, className }) {
    const st = joinState(membership);
    const label = st === "pending" ? "Applied" : st === "accepted" ? "Member" : st === "rejected" ? "Apply again" : "Join";
    const icon = st === "pending" ? "clock" : st === "accepted" ? "check" : "plus";
    const on = st === "pending" || st === "accepted";
    return React.createElement("button", {
      type: "button",
      className: (className || "com-follow com-join") + (on ? " on" : "") + (small ? " sm" : ""),
      "aria-pressed": on,
      title: st === "pending" ? "Your application is in — tap to withdraw" : st === "accepted" ? "You're a member — tap to leave" : "Join this club",
      onClick,
    }, React.createElement(Icon, { name: icon, size: small ? 12 : 13, stroke: "currentColor", width: 2.4 }), label);
  }

  // The club page's primary button — same states, `btn` styling.
  function JoinButton({ membership, onClick }) {
    const st = joinState(membership);
    const on = st === "pending" || st === "accepted";
    const label = st === "pending" ? "Applied" : st === "accepted" ? "Member" : st === "rejected" ? "Apply again" : "Join";
    const icon = st === "pending" ? "clock" : st === "accepted" ? "check" : "plus";
    return React.createElement("button", { className: "btn btn-primary" + (on ? " done" : ""), onClick, "aria-pressed": on },
      React.createElement(Icon, { name: icon, size: 17, stroke: "var(--paper)" }), label);
  }

  // The application sheet: the club's questions, then "Send application".
  function ApplyModal({ org, submitting, error, onCancel, onSubmit }) {
    const questions = org && Array.isArray(org.join_questions) ? org.join_questions : [];
    return React.createElement(AnswerSheet, {
      questions, initial: {}, submitting, error,
      title: "Join " + ((org && org.name) || "this club"),
      lede: "A few questions from the club first. They review every application — you'll hear back here.",
      submitLabel: "Send application",
      submittingLabel: "Sending…",
      submitIcon: "send",
      accent: "var(--accent)",
      onCancel, onSubmit,
    });
  }

  // The public roster on the club page.
  function MemberRoster({ members = [], count, onOpenPerson }) {
    const total = typeof count === "number" ? count : members.length;
    if (!total) return null;
    const shown = members.slice(0, ROSTER_SHOWN);
    return (
      React.createElement("div", { className: "org-section" },
        React.createElement("div", { className: "sec-h" }, "Members · " + total),
        React.createElement("div", { className: "roster" },
          shown.map((m) => React.createElement("button", {
            key: m.userId, type: "button", className: "roster-row",
            onClick: () => m.handle && onOpenPerson && onOpenPerson(m.handle),
            disabled: !m.handle || !onOpenPerson,
          },
            React.createElement(Av, { name: m.name, img: m.avatar || null, size: 34 }),
            React.createElement("span", { className: "who" },
              React.createElement("b", null, m.name),
              React.createElement("small", null, [m.handle && m.name !== "@" + m.handle ? "@" + m.handle : null, m.uni && UNI[m.uni] ? UNI[m.uni].name : null].filter(Boolean).join(" · ") || "Member")
            )
          )),
          total > shown.length && React.createElement("span", { className: "roster-more" }, "+" + (total - shown.length) + " more")
        )
      )
    );
  }

  export { JoinPill, JoinButton, ApplyModal, MemberRoster, joinState };
  export default JoinPill;
