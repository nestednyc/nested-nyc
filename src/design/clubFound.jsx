/* ============================================================
   NESTED NYC — Start a club (the student founding screen, /clubs/new)
   The same OrgForm body the org-email onboarding uses, in a student
   wrapper: type locked to "club", the campus prefilled from the
   student's profile, Cancel returns to the board (never sign-out),
   and success hands the new row to NestedApp (adoptOrgAccount →
   club mode → the dashboard). A student-founded club is live the
   moment it's created — the DB trigger stamps organizations.
   student_run from the founder's account_type, and the label
   replaces the verified tick. Redesigning this flow is a follow-up;
   the wrapper deliberately reuses the house wizard.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import OrgForm, { OrgPreview } from './orgForm'
import { createOrgFromValues } from './orgOnboard'
import { useUniversitiesList } from './useUniversitiesList'

  const { useState, useRef } = React;

  function buildClubAside({ onCancel }) {
    return (v) => (
      React.createElement("div", { className: "onb-aside corkbg grain" },
        React.createElement("div", { className: "a-top" },
          React.createElement("div", { className: "brand" },
            React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
          ),
          React.createElement("button", { className: "ghost-link", onClick: onCancel, style: { fontSize: 13 } },
            React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Back to the board"
          )
        ),
        React.createElement("div", { className: "onb-pitch" },
          React.createElement("h2", null, "Start your club.", React.createElement("br"), "It's on the board", React.createElement("br"), "the moment you pin it."),
          React.createElement("p", null, "No waiting on a review — a student-run club goes live right away. Students can follow it, join it and RSVP to what you host; you run it from club mode."),
          React.createElement("div", { className: "onb-mini-board" },
            React.createElement(OrgPreview, { name: v.name, type: "club", uni: v.uni, bio: v.bio, studentRun: true })
          )
        )
      )
    );
  }

  function ClubFound({ profile, onCancel, onCreated }) {
    const submitted = useRef(false);
    // Seeded universities: the campus slug resolves to the university_id UUID
    // the DB trigger requires for a student-run club (shared hook with OrgEdit).
    const { universities } = useUniversitiesList();
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(values) {
      if (submitted.current) return;
      submitted.current = true;
      setSubmitting(true);
      setSubmitError('');

      // type is locked client-side too — the trigger rejects anything else (PT422).
      const { org, error } = await createOrgFromValues({ ...values, type: 'club' }, universities);
      if (error) {
        submitted.current = false;
        setSubmitting(false);
        setSubmitError(error);
        return;
      }

      onCreated && onCreated(org);
    }

    return React.createElement(OrgForm, {
      mode: 'create',
      variant: 'student',
      profile,
      initialValues: { type: 'club' },
      aside: buildClubAside({ onCancel }),
      ctaCopy: { primary: submitting ? 'Pinning…' : 'Start the club', icon: 'flag' },
      onSubmit,
      onCancel,
      extraFooter: submitError ? React.createElement("span", { style: { color: "var(--c-startup)", fontFamily: "var(--mono)", fontSize: 12 } }, "// " + submitError) : null,
    });
  }

  export { ClubFound };
  export default ClubFound;
