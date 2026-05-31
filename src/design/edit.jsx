/* ============================================================
   NESTED NYC — Edit project (wrapper around <ProjectForm/>)
   Prefills the form from an existing project, swaps the aside
   to show the current flyer, and adds a "Take it down" footer
   link backed by a local confirm modal.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI } from './data'
import { Av, Facepile, CatTag, Pin } from './shared'
import ProjectForm from './projectForm'

  const { useRef, useState } = React;

  function valuesFromProject(p) {
    return {
      cat: p.cat || "",
      stage: p.stage || "",
      timeline: p.event || "",
      title: p.title || "",
      tagline: p.blurb || "",
      place: p.place || "",
      about: p.about || "",
      roles: (p.roles && p.roles.length)
        ? p.roles.map((r) => ({ title: r.title || "", note: r.note || "", open: !!r.open }))
        : [{ title: "", note: "", open: true }],
      tags: Array.isArray(p.tags) ? [...p.tags] : [],
      commitment: p.commitment || "",
      pinType: p.pinType || "tape",
      commLink: p.communicationLink || "",
    };
  }

  // Normalize a values bundle the same way ProjectForm does on submit, so
  // no-op detection can compare apples-to-apples (trim strings, drop blank
  // role rows that the UI always renders for editing convenience).
  function normalize(v) {
    return {
      cat: v.cat,
      stage: v.stage,
      timeline: (v.timeline || "").trim(),
      title: (v.title || "").trim(),
      tagline: (v.tagline || "").trim(),
      place: (v.place || "").trim(),
      about: (v.about || "").trim(),
      roles: (v.roles || [])
        .map((r) => ({ title: (r.title || "").trim(), note: (r.note || "").trim(), open: !!r.open }))
        .filter((r) => r.title),
      tags: v.tags || [],
      commitment: v.commitment,
      pinType: v.pinType || "tape",
      commLink: (v.commLink || "").trim(),
    };
  }

  function buildEditAside({ project, profile, onCancel }) {
    const cat = project.cat ? CAT[project.cat] : CAT.startup;
    const uniName = (project.uni && UNI[project.uni]) ? UNI[project.uni].name
      : (profile && profile.uni && UNI[profile.uni]) ? UNI[profile.uni].name : "Nested";
    const openRoles = (project.roles || []).filter((r) => r.open).slice(0, 3);
    const openCount = (project.roles || []).filter((r) => r.open).length;
    const isTape = (project.pinType || "tape") === "tape";

    return (_values) => (
      React.createElement("div", { className: "onb-aside corkbg grain" },
        React.createElement("div", { className: "a-top" },
          React.createElement("div", { className: "brand" },
            React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
            React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
          ),
          React.createElement("button", { className: "ghost-link", onClick: onCancel, style: { fontSize: 13 } },
            React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Back to the board"
          )
        ),
        React.createElement("div", { className: "onb-pitch" },
          React.createElement("h2", null, "Editing", React.createElement("br"), "your flyer."),
          React.createElement("p", null, "Tweak any section, then save. This is what's currently on the board."),
          React.createElement("div", { className: "create-preview-wrap", style: { padding: "8px 0 0" } },
            React.createElement("article", {
              className: "flyer grain create-preview-flyer",
              style: { "--rot": project.rot || "-2deg", maxWidth: 320 },
            },
              isTape
                ? [
                    React.createElement("span", { key: "l", className: "tape left" }),
                    React.createElement("span", { key: "r", className: "tape right" }),
                  ]
                : React.createElement(Pin, null),
              React.createElement("div", { className: "cat-bar", style: { background: cat.color } }),
              React.createElement("div", { className: "body" },
                React.createElement("div", { className: "stamp-meta" }, uniName),
                React.createElement(CatTag, { cat }),
                React.createElement("h3", null, project.title || "Your project"),
                React.createElement("p", { className: "blurb" }, project.blurb || ""),
                openRoles.length > 0 && React.createElement("div", { className: "looking" },
                  React.createElement("span", { className: "role", style: { borderStyle: "solid", background: "transparent", borderColor: "transparent", paddingLeft: 0, color: "var(--ink-faint)" } }, "looking for:"),
                  openRoles.map((r, i) => React.createElement("span", { className: "role", key: i }, r.title))
                ),
                React.createElement("div", { className: "meta" },
                  React.createElement("div", { className: "joined-by" },
                    React.createElement(Facepile, { names: [(project.lead && project.lead.name) || (profile && profile.username) || "you"], extra: 0 }),
                    React.createElement("span", { className: "txt" }, openCount === 0
                      ? "Lead pinned"
                      : openCount + " role" + (openCount === 1 ? "" : "s") + " open")
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  function ConfirmDelete({ project, onCancel, onConfirm }) {
    const cat = project.cat ? CAT[project.cat] : CAT.startup;
    return (
      React.createElement("div", { className: "scrim", onClick: onCancel },
        React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation(), style: { maxWidth: 440 } },
          React.createElement("div", { className: "cat-bar", style: { background: cat.color } }),
          React.createElement("button", { className: "modal-close", onClick: onCancel },
            React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("h2", null, "Take this flyer down?"),
            React.createElement("p", null,
              "This removes ",
              React.createElement("b", null, "“" + (project.title || "your project") + "”"),
              " from the board. You can pin a new one anytime."
            ),
            React.createElement("div", { className: "modal-actions" },
              React.createElement("button", { className: "btn btn-ghost", onClick: onCancel }, "Cancel"),
              React.createElement("button", {
                className: "btn btn-primary",
                onClick: onConfirm,
                style: { background: "var(--c-startup)", borderColor: "var(--c-startup)" },
              },
                React.createElement(Icon, { name: "x", size: 17, stroke: "var(--paper)" }),
                "Take it down")
            )
          )
        )
      )
    );
  }

  function Edit({ project, profile, onSave, onDelete, onCancel }) {
    const submitted = useRef(false);
    const [confirming, setConfirming] = useState(false);
    const initialValues = valuesFromProject(project);
    const initialKey = JSON.stringify(normalize(initialValues));

    function buildNext(values) {
      return {
        // Preserved from the original project — not editable in this form:
        id: project.id,
        rot: project.rot,
        createdAt: project.createdAt,
        joinedCount: project.joinedCount,
        team: project.team || [],
        lead: project.lead,
        uni: project.uni,
        // Ownership — carried through untouched so a save never orphans the
        // flyer. Co-admin promotion happens elsewhere, not in this form.
        ownerId: project.ownerId,
        ownerName: project.ownerName,
        admins: project.admins,
        // Status + alert are edited inline on the project page, not here —
        // preserve them so a flyer-edit never wipes the live pulse.
        status: project.status,
        alert: project.alert,
        // Editable fields, overlaid from form values:
        cat: values.cat,
        title: values.title,
        blurb: values.tagline,
        about: values.about,
        pinType: values.pinType,
        tags: values.tags,
        roles: values.roles,
        event: values.timeline,
        place: values.place,
        stage: values.stage,
        commitment: values.commitment,
        communicationLink: values.commLink,
        updatedAt: new Date().toISOString(),
      };
    }

    function onSubmit(values) {
      if (submitted.current) return;
      const nextKey = JSON.stringify(normalize(values));
      if (nextKey === initialKey) {
        // No-op save — silently return to detail, no toast.
        onCancel();
        return;
      }
      submitted.current = true;
      // Phase 2: call projectService.updateProject(...) here.
      onSave(buildNext(values));
    }

    function handleDelete() {
      if (submitted.current) return;
      submitted.current = true;
      // Phase 2: call projectService.deleteProject(...) here.
      onDelete(project.id);
    }

    const extraFooter = React.createElement("button", {
      type: "button",
      className: "ghost-link",
      onClick: () => setConfirming(true),
      style: { color: "var(--c-startup)", marginLeft: 14 },
    },
      React.createElement(Icon, { name: "x", size: 14, stroke: "currentColor" }),
      "Take it down"
    );

    return (
      React.createElement(React.Fragment, null,
        React.createElement(ProjectForm, {
          mode: "edit",
          initialValues,
          profile,
          aside: buildEditAside({ project, profile, onCancel }),
          ctaCopy: { primary: "Save changes", icon: "check" },
          onSubmit,
          onCancel,
          extraFooter,
        }),
        confirming && React.createElement(ConfirmDelete, {
          project,
          onCancel: () => setConfirming(false),
          onConfirm: () => { setConfirming(false); handleDelete(); },
        })
      )
    );
  }

  export { Edit };
  export default Edit;
