/* ============================================================
   NESTED NYC — Org onboarding (wraps <OrgForm/>)
   Called after an org signs up via authService.signUpAsOrg. Collects
   identity + branding and inserts the organizations row owned by the
   current auth user. On success, NestedApp picks up the new org via
   orgService.getMyOrgs and routes to the dashboard.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import OrgForm, { OrgPreview } from './orgForm'
import { orgService } from '../services/orgService'

  const { useState, useEffect, useRef } = React;

  function buildOnboardAside({ onCancel }) {
    return (v) => (
      React.createElement("div", { className: "onb-aside corkbg grain" },
        React.createElement("div", { className: "a-top" },
          React.createElement("div", { className: "brand" },
            React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
            React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
          ),
          React.createElement("button", { className: "ghost-link", onClick: onCancel, style: { fontSize: 13 } },
            React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Sign out"
          )
        ),
        React.createElement("div", { className: "onb-pitch" },
          React.createElement("h2", null, "Put your org", React.createElement("br"), "on the board."),
          React.createElement("p", null, "Three quick steps. Your org gets a page students can follow — and you can start pinning events to the NYC campus calendar."),
          React.createElement("div", { className: "onb-mini-board" },
            React.createElement(OrgPreview, { name: v.name, type: v.type, uni: v.uni, bio: v.bio })
          )
        )
      )
    );
  }

  function OrgOnboard({ onCancel, onCreated }) {
    const submitted = useRef(false);
    const [universities, setUniversities] = useState([]);
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Load the seeded universities so the "Campus" picker can resolve a slug
    // (e.g. "nyu") to a real university_id UUID for the FK on the insert.
    useEffect(() => {
      let cancelled = false;
      orgService.listUniversities().then(({ data }) => {
        if (!cancelled) setUniversities(data || []);
      });
      return () => { cancelled = true; };
    }, []);

    async function onSubmit(values) {
      if (submitted.current) return;
      submitted.current = true;
      setSubmitting(true);
      setSubmitError('');

      // Resolve uni slug → university_id UUID. Falls back to null when the
      // form left uni blank (universities pick "no parent"; clubs picking a
      // campus not in the seed also degrade to null).
      const uniRow = values.uni ? universities.find((u) => u.slug === values.uni) : null;

      const { data: org, error } = await orgService.createOrg({
        name: values.name,
        type: values.type,
        university_id: uniRow ? uniRow.id : null,
        bio: values.bio,
        location: values.location,
        website: values.website,
        instagram: values.instagram,
      });

      if (error) {
        submitted.current = false;
        setSubmitting(false);
        setSubmitError(error.message || 'Could not create your org. Try again.');
        return;
      }

      onCreated && onCreated(org);
    }

    return React.createElement(OrgForm, {
      mode: 'create',
      aside: buildOnboardAside({ onCancel }),
      ctaCopy: { primary: submitting ? 'Pinning…' : 'Pin your org', icon: 'pin' },
      onSubmit,
      onCancel,
      extraFooter: submitError ? React.createElement("span", { style: { color: "var(--c-startup)", fontFamily: "var(--mono)", fontSize: 12 } }, "// " + submitError) : null,
    });
  }

  export { OrgOnboard };
  export default OrgOnboard;
