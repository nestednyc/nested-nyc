/* ============================================================
   NESTED NYC — Create a project (wrapper around <ProjectForm/>)
   Assembles defaults + the "Pin what you're building" aside,
   stamps a new id/rot/createdAt, hands the project to NestedApp.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI, ownerToken, DEFAULT_STATUS } from './data'
import ProjectForm from './projectForm'

  const { useRef } = React;

  function slugify(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project";
  }

  function uniqueSlug(s, taken) {
    const base = slugify(s);
    if (!taken || !taken.has(base)) return base;
    let n = 2;
    while (taken.has(base + "-" + n)) n += 1;
    return base + "-" + n;
  }

  function buildCreateAside({ profile, onCancel }) {
    const uniName = (profile && profile.uni && UNI[profile.uni]) ? UNI[profile.uni].name : "Nested";
    return (values) => (
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
          React.createElement("h2", null, "Pin what", React.createElement("br"), "you're building."),
          React.createElement("p", null, "Five quick steps. Your flyer goes up on the board so students across NYC can find you and join in."),
          React.createElement("div", { className: "onb-mini-board" },
            React.createElement("div", { className: "mini-flyer", style: { transform: "rotate(-3deg)" } },
              React.createElement("div", { className: "cat-bar", style: { background: values.flyerColor || (values.cat ? CAT[values.cat].color : "var(--c-hack)") } }),
              React.createElement("b", null, (values.title || "").trim() || "Your project"),
              React.createElement("small", null, uniName + (values.cat ? " · " + CAT[values.cat].label.toLowerCase() : ""))
            ),
            React.createElement("div", { className: "mini-flyer", style: { transform: "rotate(2.5deg)", marginTop: 14, opacity: 0.55 } },
              React.createElement("div", { className: "cat-bar", style: { background: "var(--c-side)" } }),
              React.createElement("b", null, "Yours next"),
              React.createElement("small", null, "a teammate's flyer")
            )
          )
        )
      )
    );
  }

  function Create({ profile, existingIds, onCancel, onCreate }) {
    const submitted = useRef(false);

    function onSubmit(values) {
      if (submitted.current) return;
      submitted.current = true;
      const id = uniqueSlug(values.title, existingIds);
      const rot = (Math.random() * 6 - 3).toFixed(2) + "deg";
      // Stable ownership token: profile.id (Supabase) or username (local-only).
      const owner = ownerToken(profile);
      // Phase 2: call projectService.createProject(...) here; ownerId becomes
      // the RLS `owner = auth.uid()` check and admins[] the co-admin grant list.
      onCreate({
        id,
        cat: values.cat,
        uni: profile && profile.uni ? profile.uni : "nyu",
        title: values.title,
        blurb: values.tagline,
        about: values.about,
        rot,
        pinType: values.pinType,
        flyerColor: values.flyerColor,
        tags: values.tags,
        roles: values.roles,
        joinedCount: 0,
        // Who pinned it (super-admin) and who may edit it. Co-admins get
        // appended to `admins` later when the owner promotes a member.
        ownerId: owner,
        ownerName: profile && profile.username ? profile.username : "you",
        admins: owner ? [owner] : [],
        lead: {
          name: profile && profile.username ? profile.username : "you",
          role: "Project lead",
          bio: "",
        },
        team: [],
        event: values.timeline,
        place: values.place,
        stage: values.stage,
        commitment: values.commitment,
        communicationLink: values.commLink,
        // Live, owner-updatable pulse — flipped inline from the project page.
        status: DEFAULT_STATUS,
        alert: "",
        createdAt: new Date().toISOString(),
      });
    }

    return React.createElement(ProjectForm, {
      mode: "create",
      profile,
      aside: buildCreateAside({ profile, onCancel }),
      ctaCopy: { primary: "Pin to the board", icon: "check" },
      onSubmit,
      onCancel,
    });
  }

  export { Create };
  export default Create;
