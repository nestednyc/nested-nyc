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
import { resolveOrgUniSlug } from './data'
import { useUniversitiesList } from './useUniversitiesList'

  const { useState, useRef } = React;

  function buildOnboardAside({ onCancel }) {
    return (v) => (
      React.createElement("div", { className: "onb-aside corkbg grain" },
        React.createElement("div", { className: "a-top" },
          React.createElement("div", { className: "brand" },
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
    // Seeded universities: the "Campus" picker's slug resolves to a real
    // university_id UUID for the FK on the insert (shared hook with OrgEdit).
    const { universities, loaded, loadFailed } = useUniversitiesList();
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(values) {
      if (submitted.current) return;
      // Resolve the picked campus slug → its university_id UUID. If a campus
      // was picked but can't be resolved — list still loading, failed, empty
      // (unseeded stack), or slug missing from the seed — refuse rather than
      // silently create a campus-less org. "Refresh" is honest advice: the
      // list is fetched once per mount. A no-campus org needs no mapping, so
      // it passes; the form renders from the client taxonomy (no mount gate).
      const uniRow = values.uni ? universities.find((u) => u.slug === values.uni) : null;
      if (values.uni && !uniRow) {
        setSubmitError("Couldn't load campuses just now — refresh and try again.");
        return;
      }
      submitted.current = true;
      setSubmitting(true);
      setSubmitError('');

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

      onCreated && onCreated({ ...org, uni: resolveOrgUniSlug(org, universities) });
    }

    return React.createElement(OrgForm, {
      mode: 'create',
      aside: buildOnboardAside({ onCancel }),
      ctaCopy: { primary: submitting ? 'Pinning…' : 'Pin your org', icon: 'check' },
      onSubmit,
      onCancel,
      extraFooter: submitError ? React.createElement("span", { style: { color: "var(--c-startup)", fontFamily: "var(--mono)", fontSize: 12 } }, "// " + submitError) : null,
    });
  }

  export { OrgOnboard };
  export default OrgOnboard;
