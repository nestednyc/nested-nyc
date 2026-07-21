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
import { resolveOrgUniSlug } from './data'
import { useUniversitiesList } from './useUniversitiesList'

  const { useState } = React;

  function buildEditAside({ onCancel }) {
    return (v) => (
      React.createElement("div", { className: "onb-aside corkbg grain" },
        React.createElement("div", { className: "a-top" },
          React.createElement("div", { className: "brand" },
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
    // Seeded universities: maps a picked campus slug → university_id UUID at
    // submit, and id → slug for the prefill (shared hook with OrgOnboard).
    const { universities, uniById, loaded, loadFailed } = useUniversitiesList();
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    if (!org) return null;

    // Hold render until the universities list settles. OrgForm reads its prefill
    // once (useState initializers at mount), and the submit handler needs the
    // list to map the picked campus slug → university_id — so we let the fetch
    // resolve (success OR failure) before OrgForm mounts. Mirrors OrgView's hold.
    if (!loaded) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "disco-head" },
            React.createElement("div", { className: "head-txt" },
              React.createElement("h1", null, "Loading…")
            )
          )
        )
      );
    }

    // Prefill the campus chip. org.uni is the slug already resolved at session
    // hydration (and kept fresh on every save), so it's correct even if THIS
    // screen's listUniversities() is slow or fails; fall back to the freshly
    // fetched id→slug map only if the enriched slug is somehow absent.
    // University-type orgs get NO prefill: their org.uni is their OWN slug
    // (campus branding), not a parent campus — seeding it into the chip would
    // make a type flip to club silently save a self-referential university_id.
    const uniSlug = org.type === 'university' ? '' : (org.uni
      || (org.university_id && uniById[org.university_id] ? uniById[org.university_id].slug : ''));

    const initialValues = {
      name: org.name || '',
      slug: org.slug || '',
      type: org.type || '',
      uni: uniSlug,
      bio: org.bio || '',
      location: org.location || '',
      // Seed the builder from links; a pre-migration row (empty links, legacy
      // website/instagram populated) synthesizes rows so the editor still
      // shows them. Plain https strings, so this doesn't lean on the
      // @-handle resolver.
      links: (Array.isArray(org.links) && org.links.length)
        ? [...org.links]
        : [org.website, org.instagram && 'https://instagram.com/' + String(org.instagram).replace(/^@+/, '')].filter(Boolean),
    };

    async function onSubmit(values) {
      setSubmitting(true);
      setSubmitError('');

      // Exclude the org's own row: an ex-university org must never become its
      // own parent campus (a self-referential FK the flyer can't resolve).
      const uniRow = values.uni
        ? universities.find((u) => u.slug === values.uni && u.id !== org.id)
        : null;
      const campusChanged = values.uni !== (initialValues.uni || '');

      // Setting/switching to a real campus needs the seed list to translate
      // the slug → university_id. If that mapping isn't available — list
      // failed, still loading, empty (unseeded stack), or slug missing —
      // refuse the change with a clear message rather than silently saving
      // the wrong campus. Clearing needs no list, so it's allowed; an
      // untouched campus is preserved as-is below. Every other field saves.
      if (campusChanged && values.uni && !uniRow) {
        setSubmitting(false);
        setSubmitError("Couldn't load campuses just now — refresh and try again to change your campus.");
        return;
      }

      const updates = {
        name: values.name,
        type: values.type,
        // Campus untouched → preserve the stored FK verbatim (immune to a
        // slow/failed/empty list on unrelated saves). Changed → the guard
        // above guarantees uniRow when a campus was picked; cleared → null.
        university_id: campusChanged ? (values.uni ? uniRow.id : null) : org.university_id,
        bio: values.bio,
        location: values.location,
        links: values.links,
        // Legacy fields are superseded by links — null them on every save so
        // a deliberately emptied builder can't resurrect old pills through
        // the read-side legacy fallback.
        website: null,
        instagram: null,
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
      // Keep the dashboard flyer's campus mark. A changed campus passed the
      // guard, so the fresh list resolves it. Untouched → the FK was preserved
      // verbatim, so reuse the already-resolved slug when a parent survives
      // (immune to an empty/failed list); resolveOrgUniSlug still covers the
      // university-type (own slug) and cleared cases.
      onSaved && onSaved({
        ...data,
        uni: campusChanged
          ? resolveOrgUniSlug(data, universities)
          : (data.university_id ? org.uni : resolveOrgUniSlug(data, universities)),
      });
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
