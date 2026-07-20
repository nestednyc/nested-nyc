/* ============================================================
   FullScreens — the full-screen routes (no topbar): the auth
   flows, org onboarding/edit, event create/edit, and project
   create/edit. Render-only: every guard (skeleton hold,
   missing-draft bounce, admin bounce) stays in NestedApp's
   dispatch — those run render-phase corrections that must not
   execute in a child component. `draft` / `editProject` arrive
   pre-resolved from the root for the same reason.
   ============================================================ */
import React from 'react'
import Onboarding from '../onboarding'
import ForgotPassword from '../forgot'
import OrgSignup from '../orgSignup'
import OrgOnboard from '../orgOnboard'
import OrgEdit from '../orgEdit'
import EventForm from '../eventForm'
import Create from '../create'
import Edit from '../edit'
import { Toasts } from '../shared'
import { StyleTweaks } from '../tweaks-panel'
import { parse as parseLocation } from '../router'

export default function FullScreens({ screen, draft, editProject, api }) {
  const {
    t, setTweak, toasts, rootClass, rootStyle,
    setRoute, applyParsed, peekReturnTo, takeReturnTo,
    authMode, toast, setJustVerified,
    forgotEmailSeed, setForgotEmailSeed, forgotFrom, setForgotFrom,
    orgAuthMode, setOrgAuthMode,
    profile, adoptProfile, orgAccount, adoptOrgAccount, hydrateSession, signOut,
    detailId, setEditId, setEventDraftId,
    projectsList, createProject, saveProjectEdits, deleteProjectById,
    createOrgEvent, updateOrgEvent,
  } = api;

  // Every full-screen route shares this frame: the tokened root div plus the
  // toast layer and the dev-only tweaks panel. Screens differ only in the child.
  const frame = (child) => (
    React.createElement("div", { className: rootClass, style: rootStyle },
      child,
      React.createElement(Toasts, { items: toasts }),
      React.createElement(StyleTweaks, { t, setTweak })
    )
  );

  if (screen === "onboarding") {
      return frame(
        React.createElement(Onboarding, {
          initialMode: authMode,
          returnTo: peekReturnTo(),
          onComplete: (p) => {
            adoptProfile(p); // ref + state together — applyParsed below role-gates on it
            const ret = takeReturnTo();
            const target = ret && ret !== "/" ? parseLocation(ret, "") : null;
            if (target) {
              // They were headed somewhere — take them back (replacing the
              // auth entry) instead of the profile-edit nudge.
              applyParsed(target, { replace: true });
              window.scrollTo({ top: 0 });
              toast("Welcome to Nested, @" + p.username, "sparkle");
            } else {
              // The wizard now handles profile enrichment inline (name, photo,
              // skills, …), so a fresh signup lands straight on the board
              // rather than being dropped into the profile-edit page.
              setRoute("discover"); window.scrollTo({ top: 0 });
              toast("Welcome to Nested, @" + p.username, "sparkle");
            }
            setJustVerified(true);
            setTimeout(() => setJustVerified(false), 1500);
          },
          onOrgPath: () => { setRoute("orgSignup"); window.scrollTo({ top: 0 }); },
          // An org account signing in at the student door is rejected there
          // (toast + sign-out); onToast surfaces the reason before it unmounts.
          onToast: toast,
          onForgot: (seedEmail) => {
            setForgotEmailSeed(seedEmail || "");
            setForgotFrom("onboarding");
            setRoute("forgot");
            window.scrollTo({ top: 0 });
          },
        })
      );
  }

  if (screen === "forgot") {
      return frame(
        React.createElement(ForgotPassword, {
          initialEmail: forgotEmailSeed,
          onBack: () => {
            // An org abandoning the reset left the SIGN-IN form — reopen it
            // there (OrgSignup remounts, so the mode must travel as a prop).
            if (forgotFrom === "orgSignup") setOrgAuthMode("signin");
            setRoute(forgotFrom);
            window.scrollTo({ top: 0 });
          },
          onComplete: () => {
            // updatePassword left us with a real session — let the shared
            // hydration helper route us (student → discover, org → dashboard).
            toast("Password updated", "check");
            hydrateSession();
          },
        })
      );
  }

  if (screen === "orgSignup") {
      // Any successful auth here routes by what the ACCOUNT is, not by which
      // door was used: hydrateSession sends org owners to their dashboard,
      // org_admin signups without an org row to orgOnboarding, and a student
      // who wandered in (or got their account confirmed here) to the STUDENT
      // side — never into org creation.
      const orgAuthDone = () => {
        setOrgAuthMode("signup");
        hydrateSession();
        window.scrollTo({ top: 0 });
      };
      return frame(
        React.createElement(OrgSignup, {
          initialMode: orgAuthMode,
          initialEmail: forgotFrom === "orgSignup" ? forgotEmailSeed : "",
          onBack: () => { setOrgAuthMode("signup"); setRoute("onboarding"); },
          onForgot: (seedEmail) => {
            setForgotEmailSeed(seedEmail || "");
            setForgotFrom("orgSignup");
            setRoute("forgot");
            window.scrollTo({ top: 0 });
          },
          onSignedUp: orgAuthDone,
          onSignedIn: orgAuthDone,
        })
      );
  }

  if (screen === "orgOnboarding") {
      return frame(
        React.createElement(OrgOnboard, {
          onCancel: signOut,
          onCreated: (org) => {
            adoptOrgAccount(org);
            setRoute("orgDashboard");
            window.scrollTo({ top: 0 });
            toast("Your org is on the board");
          },
        })
      );
  }

  if (screen === "orgEditMe") {
      return frame(
        React.createElement(OrgEdit, {
          org: orgAccount,
          onCancel: () => setRoute("orgDashboard"),
          onSaved: (org) => {
            adoptOrgAccount(org);
            setRoute("orgDashboard");
            toast("Org page updated", "check");
          },
        })
      );
  }

  if (screen === "eventCreate") {
      return frame(
        React.createElement(EventForm, {
          mode: "create",
          org: orgAccount,
          onCancel: () => setRoute("orgDashboard"),
          onSubmit: createOrgEvent,
        })
      );
  }

  if (screen === "create") {
      return frame(
        React.createElement(Create, {
          profile,
          existingIds: new Set(projectsList.map((p) => p.id)),
          onCancel: () => setRoute("discover"),
          onCreate: createProject,
        })
      );
  }

  if (screen === "eventEdit") {
      return frame(
        React.createElement(EventForm, {
          mode: "edit",
          org: orgAccount,
          initialValues: {
            title: draft.title || '',
            event_type: draft.event_type || '',
            description: draft.description || '',
            tags: draft.tags || [],
            date: draft.date || '',
            time: draft.time || '',
            duration: draft.duration || '',
            location: draft.location || '',
            address: draft.address || '',
            max_attendees: draft.max_attendees ? String(draft.max_attendees) : '',
          },
          onCancel: () => { setEventDraftId(null); setRoute("orgDashboard"); },
          onSubmit: (fields) => updateOrgEvent(draft.id, fields),
        })
      );
  }

  if (screen === "edit") {
      return frame(
        React.createElement(Edit, {
          project: editProject,
          profile,
          onCancel: () => {
            setEditId(null);
            setRoute(detailId === editProject.id ? "detail" : "discover");
          },
          onSave: saveProjectEdits,
          onDelete: deleteProjectById,
        })
      );
  }

  return null;
}
