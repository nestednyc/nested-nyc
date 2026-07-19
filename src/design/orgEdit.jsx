/* ============================================================
   NESTED NYC — Edit your org (wraps <OrgForm mode="edit"/>)
   Owner-only editor for the org's identity + branding. Re-uses the
   3-step form body from orgForm so create and edit stay visually
   identical; only the submit handler differs.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import OrgForm, { OrgPreview } from './orgForm'
import { orgService } from '../services/orgService'

  const { useState, useEffect } = React;

  function buildEditAside({ onCancel }) {
    return (v) => (
      React.createElement("div", { className: "onb-aside corkbg grain" },
        React.createElement("div", { className: "a-top" },
          React.createElement("div", { className: "brand" },
            React.createElement("span", { className: "mark" }, "N"),
            React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
          ),
          React.createElement("button", { className: "ghost-link", onClick: onCancel, style: { fontSize: 13 } },
            React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Back to dashboard"
          )
        ),
        React.createElement("div", { className: "onb-pitch" },
          React.createElement("h2", null, "Tune your", React.createElement("br"), "org page."),
          React.createElement("p", null, "Polish the bio, swap the campus, update your links — students see changes the moment you save."),
          React.createElement("div", { className: "onb-mini-board" },
            React.createElement(OrgPreview, { name: v.name, type: v.type, uni: v.uni, bio: v.bio })
          )
        )
      )
    );
  }

  function OrgEdit({ org, onCancel, onSaved }) {
    const [universities, setUniversities] = useState([]);
    const [uniById, setUniById] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
      let cancelled = false;
      orgService.listUniversities().then(({ data }) => {
        if (cancelled) return;
        setUniversities(data || []);
        const map = {};
        (data || []).forEach((u) => { map[u.id] = u; });
        setUniById(map);
      });
      return () => { cancelled = true; };
    }, []);

    if (!org) return null;

    // Prefill: resolve university_id (UUID) → slug for the form's chip picker.
    const uniSlug = org.university_id && uniById[org.university_id]
      ? uniById[org.university_id].slug
      : '';

    const initialValues = {
      name: org.name || '',
      slug: org.slug || '',
      type: org.type || '',
      uni: uniSlug,
      bio: org.bio || '',
      location: org.location || '',
      website: org.website || '',
      instagram: org.instagram || '',
    };

    async function onSubmit(values) {
      setSubmitting(true);
      setSubmitError('');

      const uniRow = values.uni ? universities.find((u) => u.slug === values.uni) : null;
      const updates = {
        name: values.name,
        type: values.type,
        university_id: uniRow ? uniRow.id : null,
        bio: values.bio,
        location: values.location,
        website: values.website,
        instagram: values.instagram,
      };
      // Slug is deliberately NOT in updates — slug changes break inbound links
      // and aren't a user-facing concern. orgService.updateOrg would accept it
      // but we keep this form scoped to the identity + branding fields.

      const { data, error } = await orgService.updateOrg(org.id, updates);
      setSubmitting(false);

      if (error) {
        setSubmitError(error.message || 'Could not save changes. Try again.');
        return;
      }
      onSaved && onSaved(data);
    }

    return React.createElement(OrgForm, {
      mode: 'edit',
      initialValues,
      aside: buildEditAside({ onCancel }),
      ctaCopy: { primary: submitting ? 'Saving…' : 'Save changes', icon: 'check' },
      onSubmit,
      onCancel,
      extraFooter: submitError ? React.createElement("span", { style: { color: "var(--c-startup)", fontFamily: "var(--mono)", fontSize: 12 } }, "// " + submitError) : null,
    });
  }

  export { OrgEdit };
  export default OrgEdit;
