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
import { dataUrlToFile } from './profileAdapter'
import { storageService } from '../services/storageService'

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
            React.createElement(OrgPreview, { name: v.name, type: v.type, uni: v.uni, bio: v.bio, logo: v.logo })
          )
        )
      )
    );
  }

  // The DB answers a founding insert with PT4xx SQLSTATEs whose messages are
  // already human (organizations triggers: campus / type / cap → PT422,
  // profile not finished → PT403); only the rate limiter speaks in code.
  function orgErrorMessage(error, fallback) {
    if (!error) return fallback;
    if (error.code === "PT429" || error.message === "rate_limited") return "Slow down — that's a few orgs in one hour. Try again a little later.";
    return error.message || fallback;
  }

  // The create-side submit, shared with the student founding screen
  // (clubFound.jsx): resolve the picked campus slug → its university_id UUID,
  // upload a freshly picked logo, insert the row. Returns { org, error } with
  // `error` a string ready for the footer. If a campus was picked but can't
  // be resolved — list still loading, failed, empty (unseeded stack), or slug
  // missing from the seed — refuse rather than silently create a campus-less
  // org. "Refresh" is honest advice: the list is fetched once per mount.
  async function createOrgFromValues(values, universities) {
    const uniRow = values.uni ? (universities || []).find((u) => u.slug === values.uni) : null;
    if (values.uni && !uniRow) {
      return { org: null, error: "Couldn't load campuses just now — refresh and try again." };
    }

    let logo = values.logo || null;
    if (logo && logo.startsWith('data:')) {
      const file = await dataUrlToFile(logo, 'logo.jpg');
      const { url, error: upErr } = await storageService.uploadOrgLogo('new', file);
      if (upErr || !url) {
        return { org: null, error: (upErr && upErr.message) || "Couldn't upload the logo — try a smaller image." };
      }
      logo = url;
    }

    const { data: org, error } = await orgService.createOrg({
      name: values.name,
      type: values.type,
      university_id: uniRow ? uniRow.id : null,
      logo,
      bio: values.bio,
      location: values.location,
      links: values.links,
      join_questions: values.joinQuestions || [],
      join_url: values.joinUrl ? values.joinUrl : null,
    });
    if (error) return { org: null, error: orgErrorMessage(error, 'Could not create your org. Try again.') };

    return { org: { ...org, uni: resolveOrgUniSlug(org, universities || []) }, error: null };
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
      submitted.current = true;
      setSubmitting(true);
      setSubmitError('');

      const { org, error } = await createOrgFromValues(values, universities);
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
      aside: buildOnboardAside({ onCancel }),
      ctaCopy: { primary: submitting ? 'Pinning…' : 'Pin your org', icon: 'check' },
      onSubmit,
      onCancel,
      extraFooter: submitError ? React.createElement("span", { style: { color: "var(--c-startup)", fontFamily: "var(--mono)", fontSize: 12 } }, "// " + submitError) : null,
    });
  }

  export { OrgOnboard, createOrgFromValues };
  export default OrgOnboard;
