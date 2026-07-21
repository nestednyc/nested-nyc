/* ============================================================
   NESTED NYC — Project detail
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI, isProjectAdmin, isProjectOwner, projectAdminSet, coLeadsOf, statusMeta, STATUSES } from './data'
import { CatTag, Av, Facepile, ConfirmModal } from './shared'
import { LinkPill } from './people'

  const { useState } = React;

  /* Live status pill + "latest update" note. Admins edit both inline —
     the status via a one-click popover, the alert via a click-to-edit note.
     Non-admins see the pill, and the note only when there's an update. */
  function StatusBlock({ p, isAdmin, onUpdate }) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(p.alert || "");
    const meta = statusMeta(p.status);
    const hasAlert = !!(p.alert && p.alert.trim());
    const canEdit = isAdmin && typeof onUpdate === "function";

    function pickStatus(id) { setOpen(false); if (id !== p.status) onUpdate({ status: id }); }
    function startEdit() { setDraft(p.alert || ""); setEditing(true); }
    function saveAlert() { setEditing(false); if ((draft || "").trim() !== (p.alert || "").trim()) onUpdate({ alert: draft.trim() }); }

    const pillStyle = { color: meta.ink, background: meta.wash };
    const dot = React.createElement("span", { className: "status-dot", style: { background: meta.ink } });

    const pill = canEdit
      ? React.createElement("div", { className: "status-pickwrap" },
          React.createElement("button", {
            className: "status-pill editable", style: pillStyle,
            onClick: () => setOpen((v) => !v), title: "Change status",
          }, dot, meta.label, React.createElement("span", { className: "status-caret", style: { borderTopColor: meta.ink } })),
          open && React.createElement("div", { className: "status-pop" },
            STATUSES.map((s) => React.createElement("button", {
              key: s.id, className: "status-pop-item" + (s.id === p.status ? " on" : ""),
              onClick: () => pickStatus(s.id),
            },
              React.createElement("span", { className: "status-dot", style: { background: s.ink } }),
              s.label,
              s.id === p.status && React.createElement(Icon, { name: "check", size: 14, stroke: meta.ink })
            ))
          )
        )
      : React.createElement("span", { className: "status-pill", style: pillStyle }, dot, meta.label);

    let note = null;
    if (editing) {
      note = React.createElement("div", { className: "alert-note editing" },
        React.createElement("div", { className: "alert-kicker" }, "// latest update"),
        React.createElement("textarea", {
          className: "alert-input", value: draft, autoFocus: true, rows: 2, maxLength: 140,
          placeholder: "Looking for a backend dev · MVP is live · need beta testers…",
          onChange: (e) => setDraft(e.target.value),
          onKeyDown: (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveAlert(); if (e.key === "Escape") setEditing(false); },
        }),
        React.createElement("div", { className: "alert-actions" },
          React.createElement("span", { className: "alert-count" }, draft.length + " / 140"),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => setEditing(false) }, "Cancel"),
          React.createElement("button", { className: "btn btn-primary btn-sm", onClick: saveAlert },
            React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)" }), "Post update")
        )
      );
    } else if (hasAlert) {
      note = React.createElement("div", { className: "alert-note" + (canEdit ? " editable" : ""), onClick: canEdit ? startEdit : undefined },
        React.createElement("div", { className: "alert-kicker" }, "// latest update"),
        React.createElement("p", null, p.alert),
        canEdit && React.createElement("span", { className: "alert-edit" }, "Edit")
      );
    } else if (canEdit) {
      note = React.createElement("button", { className: "alert-add", onClick: startEdit },
        React.createElement(Icon, { name: "plus", size: 15, stroke: "var(--accent)" }),
        "Post a quick update — what's happening right now?"
      );
    }

    return React.createElement("div", { className: "status-block" },
      React.createElement("div", { className: "status-row" },
        React.createElement("span", { className: "status-lbl" }, "Status"),
        pill
      ),
      note
    );
  }

  /* Retro 90s hit counter — "YOU ARE VISITOR No. 0042" — at the foot of the
     flyer's left column. Ambient flavor, not a CTA. Each cell holds a 0–9
     reel translated to its digit: hitRoll rolls it up from 0 once on mount
     (staggered per cell) and the transform transition ticks it live when the
     fresh total lands from record_project_view. Cells are keyed from the
     RIGHT (ones digit = key 1) so reels keep identity when the number grows
     a digit. Static under prefers-reduced-motion. */
  function HitCounter({ count }) {
    const n = Math.max(0, Math.floor(count || 0));
    const digits = String(n).padStart(4, "0").split("");
    return React.createElement("div", { className: "hit-counter", role: "img", "aria-label": n + " visits so far" },
      React.createElement("span", { className: "hit-label" }, "you are visitor No."),
      React.createElement("span", { className: "hit-digits", "aria-hidden": true },
        digits.map((d, i) => React.createElement("span", { className: "hit-cell", key: digits.length - i },
          React.createElement("span", { className: "hit-reel", style: { "--digit": d, animationDelay: (i * 70) + "ms" } },
            "0123456789".split("").map((x) => React.createElement("span", { key: x }, x))
          )
        ))
      )
    );
  }


  /* Crew manager behind the crew card's "✦ …" link. The OWNER (canPromote)
     promotes/demotes co-leads and can remove anyone; a co-lead (canPromote
     false) gets a remove-only view of regular crew — no co-lead section, no
     "make co-lead" chip. Rows are INERT (no profile click-through — one
     surface, one meaning): the role move is one labeled chip (promote →
     confirm, demote instant since it's reversible), and the destructive kick
     lives in the mono sub-line as marginalia ("· ✕ remove" → ConfirmKick). */
  function CoLeadModal({ p, coLeads, candidates, canPromote, onCancel, onPick, onStepDown, onKick }) {
    const cat = CAT[p.cat];
    const removeLink = (m) => onKick && React.createElement("button", {
      className: "row-remove",
      title: "Remove " + m.name + " from the crew",
      onClick: () => onKick(m),
    }, "· ✕ remove");
    // Only the co-lead section is owner-gated; candidates (regular crew) show
    // for any manager, so the pile is empty only when there are no candidates
    // AND (for the owner) no co-leads either.
    const pileEmpty = !candidates.length && (!canPromote || !coLeads.length);
    return (
      React.createElement("div", { className: "scrim", onClick: onCancel },
        React.createElement("div", { className: "modal", onClick: (e) => e.stopPropagation(), style: { maxWidth: 440 } },
          React.createElement("div", { className: "cat-bar", style: { background: p.flyerColor || cat.color } }),
          React.createElement("button", { className: "modal-close", onClick: onCancel },
            React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "modal-inner" },
            React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 6 } }, canPromote ? "// co-sign the flyer" : "// manage the crew"),
            React.createElement("h2", null, canPromote ? "Who's leading this with you?" : "Manage the crew"),
            React.createElement("p", null, canPromote
              ? "A co-lead runs the flyer with you — edits, status, updates, and the join inbox."
              : "Remove anyone who's no longer part of this project. Only the owner can add or change co-leads."),
            React.createElement("div", { className: "team-pile crew-pile", style: { marginTop: 14 } },
              canPromote && coLeads.map((m) => React.createElement("div", { className: "team-row", key: "cl-" + m.userId },
                React.createElement(Av, { name: m.name, img: m.image }),
                React.createElement("span", { className: "t-who", style: { flex: 1, minWidth: 0 } },
                  React.createElement("b", null, m.name),
                  React.createElement("small", null, "Co-lead", removeLink(m))),
                React.createElement("button", {
                  className: "crew-chip",
                  title: "Move " + m.name + " back to regular crew",
                  onClick: () => onStepDown(m),
                }, React.createElement(Icon, { name: "undo", size: 13 }), "back to crew")
              )),
              candidates.map((m) => React.createElement("div", { className: "team-row", key: "c-" + m.userId },
                React.createElement(Av, { name: m.name, img: m.image }),
                React.createElement("span", { className: "t-who", style: { flex: 1, minWidth: 0 } },
                  React.createElement("b", null, m.name),
                  React.createElement("small", null, m.role, removeLink(m))),
                canPromote && React.createElement("button", {
                  className: "crew-chip promote",
                  title: "Make " + m.name + " a co-lead",
                  onClick: () => onPick(m),
                }, React.createElement(Icon, { name: "sparkle", size: 13 }), "make co-lead")
              )),
              // Reachable mid-session: the last removable/promotable row just went.
              pileEmpty && React.createElement("p", {
                style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)", margin: 0 },
              }, canPromote ? "When someone joins the crew, you can promote them here." : "No crew to remove right now.")
            )
          )
        )
      )
    );
  }

  /* Owner-only confirm before removing someone from the crew — destructive
     enough (their seat, their co-lead grant) to warrant a deliberate click. */
  function ConfirmKick({ p, member, onCancel, onConfirm }) {
    return React.createElement(ConfirmModal, {
      accent: p.flyerColor || CAT[p.cat].color,
      title: "Remove " + member.name.split(" ")[0] + " from the crew?",
      body: React.createElement(React.Fragment, null,
        React.createElement("b", null, member.name),
        " comes off “" + (p.title || "this project") + "” and their spot opens back up. They can always request to join again."),
      ctaLabel: "Remove them", ctaIcon: "x", danger: true,
      onCancel, onConfirm,
    });
  }

  /* Owner-only confirm before promoting a crew member. Co-lead is a real
     grant (edit the flyer, post updates, run the join inbox) so it gets a
     deliberate click; demoting is one click since it's instantly reversible. */
  function ConfirmPromote({ p, member, onCancel, onConfirm }) {
    return React.createElement(ConfirmModal, {
      accent: p.flyerColor || CAT[p.cat].color,
      title: "Make " + member.name.split(" ")[0] + " a co-lead?",
      body: React.createElement(React.Fragment, null,
        React.createElement("b", null, member.name),
        " will run this project with you — edit the flyer, change the status, post updates, and approve requests to join. Only you can take the flyer down or change co-leads."),
      ctaLabel: "Make co-lead", ctaIcon: "sparkle",
      onCancel, onConfirm,
    });
  }

  function ProjectDetail({ p, profile, saved, joined, requested, onBack, onSave, onRequest, onMessage, onEdit, onUpdateStatus, onSetCoLead, onKickMember, pendingRequests = [], onApprove, onReject, onOpenProfile }) {
    const cat = CAT[p.cat];
    const uni = UNI[p.uni];
    // teamNames = lead + joiners (for the "crew" facepile); extra counts faces
    // beyond the 3 shown. joinedCount itself is joiners-only (excludes the lead).
    const teamNames = [p.lead.name, ...p.team.map((t) => t.name)];
    const extra = Math.max(0, teamNames.length - 3);
    // Admin (owner or co-admin) edits status/alert inline and sees the edit CTA.
    const isAdmin = isProjectAdmin(p, profile);
    const isOwner = !!(onEdit && isAdmin);
    // Co-leads = crew members promoted into projects.admins. Only the TRUE
    // owner (not a co-lead) can promote/demote — isProjectAdmin vs isProjectOwner.
    const adminSet = projectAdminSet(p);
    const coLeads = coLeadsOf(p);
    // Crew members the owner could still promote (have a real account, not
    // already a co-lead). Rows without a userId are legacy denormalized members.
    const coLeadCandidates = p.team.filter((t) => t.userId && !adminSet.has(t.userId));
    const canManageCoLeads = isProjectOwner(p, profile) && typeof onSetCoLead === "function";
    // A co-lead (any admin) can remove regular crew — coLeadCandidates is
    // exactly that set (has a userId, not in admins, so never the owner or a
    // co-lead). Promote/demote stays owner-only (canManageCoLeads above).
    const canManageCrew = isProjectAdmin(p, profile) && typeof onKickMember === "function";
    // The crew manager's only entry point: an inline action on the crew card's
    // annotation line — a manager sees "✦ …" where visitors see marginalia.
    // Owner opens it to promote/demote OR remove; a co-lead only when there's
    // regular crew to remove.
    const coLeadAction = (canManageCoLeads && (coLeads.length > 0 || coLeadCandidates.length > 0))
      || (canManageCrew && coLeadCandidates.length > 0);
    // Promote/demote lives behind one quiet link in the masthead — the picker
    // modal (step 1) then ConfirmPromote (step 2). Crew rows stay untouched.
    const [coLeadsOpen, setCoLeadsOpen] = useState(false);
    const [promoting, setPromoting] = useState(null); // crew member pending promote-confirm
    const [kicking, setKicking] = useState(null);     // crew member pending remove-confirm
    // Crew + lead rows deep-link to each person's real profile when we know
    // their user id (carried through from team_members.user_id / owner_id).
    const canOpen = typeof onOpenProfile === "function";
    function personRow(name, sub, userId, key, img, handle) {
      const clickable = canOpen && !!userId;
      return React.createElement("div", {
        className: "team-row" + (clickable ? " clickable" : ""), key,
        onClick: clickable ? () => onOpenProfile(userId) : undefined,
        title: clickable ? "View " + name + "'s profile" : undefined,
      },
        React.createElement(Av, { name, img }),
        React.createElement("span", { className: "t-who" },
          React.createElement("b", null, name),
          (handle && name !== "@" + handle) && React.createElement("small", { style: { display: "block", color: "var(--ink-soft)" } }, "@" + handle),
          React.createElement("small", null, sub))
      );
    }

    return (
      React.createElement("div", { className: "detail-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "The board")
        ),

        coLeadsOpen && !promoting && !kicking && React.createElement(CoLeadModal, {
          p, coLeads, candidates: coLeadCandidates, canPromote: canManageCoLeads,
          onCancel: () => setCoLeadsOpen(false),
          onPick: (m) => setPromoting(m),
          onStepDown: (m) => onSetCoLead(p.id, m.userId, false),
          onKick: typeof onKickMember === "function" ? (m) => setKicking(m) : null,
        }),
        promoting && React.createElement(ConfirmPromote, {
          p, member: promoting,
          // Cancel returns to the picker (coLeadsOpen is still true); confirm
          // closes the whole flow — the byline change is the payoff.
          onCancel: () => setPromoting(null),
          onConfirm: () => {
            const m = promoting;
            setPromoting(null);
            setCoLeadsOpen(false);
            onSetCoLead(p.id, m.userId, true);
          },
        }),
        kicking && React.createElement(ConfirmKick, {
          p, member: kicking,
          // Cancel returns to the picker; confirm stays in it so the owner can
          // keep tidying the crew — the row just disappears from the list.
          onCancel: () => setKicking(null),
          onConfirm: () => {
            const m = kicking;
            setKicking(null);
            onKickMember(p.id, m.userId);
          },
        }),

        React.createElement("div", { className: "detail grain fade-up" },
          React.createElement("div", { className: "cat-bar", style: { background: p.flyerColor || cat.color } }),
          React.createElement("div", { className: "detail-inner" },
            React.createElement("div", { className: "detail-top" },
              React.createElement(CatTag, { cat, large: true }),
              React.createElement("button", {
                className: "savebtn" + (saved ? " on" : ""), style: { width: 42, height: 42 },
                onClick: () => onSave(p.id),
              }, React.createElement(Icon, { name: "bookmark", size: 19, fill: saved ? "var(--accent)" : "none" }))
            ),
            React.createElement("h1", null, p.title),
            React.createElement("p", { className: "lede" }, p.blurb),

            React.createElement(StatusBlock, { p, isAdmin, onUpdate: (patch) => onUpdateStatus && onUpdateStatus(p.id, patch) }),

            React.createElement("div", { className: "detail-cta" },
              isOwner
                ? React.createElement("button", { className: "btn btn-primary", onClick: () => onEdit(p) }, "Edit flyer")
                : React.createElement("button", {
                    // `joined` = approved member ("You're in"); `requested` =
                    // pending request ("Request sent"). Both render the green
                    // "done" treatment; only the unjoined state is a live CTA.
                    className: "btn " + (joined || requested ? "btn-primary done" : "btn-primary"), onClick: () => onRequest(p),
                  }, joined
                    ? [React.createElement(Icon, { name: "check", size: 18, stroke: "var(--paper)", key: "i" }), "You're in"]
                    : requested
                      ? [React.createElement(Icon, { name: "clock", size: 18, stroke: "var(--paper)", key: "i" }), "Request sent"]
                      : !profile
                        ? [React.createElement(Icon, { name: "arrowRight", size: 18, stroke: "var(--paper)", key: "i" }), "Sign in to join"]
                        : [React.createElement(Icon, { name: "plus", size: 18, stroke: "var(--paper)", key: "i" }), "Request to join"])
            ),

            React.createElement("div", { className: "detail-grid" },
              // main column
              React.createElement("div", null,
                React.createElement("div", { className: "detail-body" },
                  React.createElement("div", { className: "sec-h" }, "About this project"),
                  React.createElement("p", null, p.about)
                ),
                React.createElement("div", { className: "detail-section" },
                  React.createElement("div", { className: "sec-h" }, "Roles open"),
                  React.createElement("div", { className: "role-list" },
                    p.roles.map((r, i) => (
                      React.createElement("div", { className: "role-row" + (r.open ? "" : " filled"), key: i },
                        React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: roleIcon(r.title), size: 18, stroke: "var(--accent)" })),
                        React.createElement("span", { className: "r-info" },
                          React.createElement("b", null, r.title),
                          React.createElement("small", null, r.note)
                        ),
                        React.createElement("span", { className: "r-status " + (r.open ? "open" : "taken") }, r.open ? "Open" : "Filled")
                      )
                    ))
                  )
                ),
                React.createElement("div", { className: "detail-section" },
                  React.createElement("div", { className: "sec-h" }, "Tags"),
                  React.createElement("div", { className: "tags" },
                    p.tags.map((t, i) => React.createElement("span", { className: "tag2", key: i }, t))
                  )
                ),
                React.createElement(HitCounter, { count: p.views })
              ),

              // side rail
              React.createElement("div", { className: "rail" },
                // Owner-only: pending join requests with approve / decline.
                isOwner && pendingRequests.length > 0 && React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "sec-h" }, "Requests to join · " + pendingRequests.length),
                  React.createElement("div", { className: "team-pile" },
                    pendingRequests.map((req) => (
                      React.createElement("div", { className: "team-row", key: req.id, style: { alignItems: "flex-start" } },
                        React.createElement(Av, { name: req.name, img: req.image }),
                        React.createElement("span", { className: "t-who", style: { flex: 1 } },
                          React.createElement("b", null, req.name),
                          (req.handle && req.name !== "@" + req.handle) && React.createElement("small", { style: { display: "block", color: "var(--ink-soft)" } }, "@" + req.handle),
                          req.role && React.createElement("small", { style: { display: "block", color: "var(--accent-ink)", fontWeight: 600 } }, "for " + req.role),
                          React.createElement("small", null, req.message || req.school || "wants to join")
                        ),
                        React.createElement("span", { style: { display: "flex", gap: 6 } },
                          React.createElement("button", { className: "btn btn-primary btn-sm", title: "Approve", onClick: () => onApprove && onApprove(req.id) },
                            React.createElement(Icon, { name: "check", size: 14, stroke: "var(--paper)" })),
                          React.createElement("button", { className: "btn btn-ghost btn-sm", title: "Decline", onClick: () => onReject && onReject(req.id) },
                            React.createElement(Icon, { name: "x", size: 14 }))
                        )
                      )
                    ))
                  )
                ),
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "calendar", size: 17 })),
                    React.createElement("span", { className: "kv-t" }, React.createElement("small", null, "Timeline"), React.createElement("b", null, p.event))
                  ),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "map", size: 17 })),
                    React.createElement("span", { className: "kv-t" }, React.createElement("small", null, "Based at"), React.createElement("b", null, p.place))
                  ),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "users", size: 17 })),
                    React.createElement("span", { className: "kv-t" }, React.createElement("small", null, "Team"), React.createElement("b", null, (p.joinedCount === 0 ? "Just the lead" : p.joinedCount + " joined") + " · " + p.roles.filter((r) => r.open).length + " roles open"))
                  )
                ),
                // Public "find it online" pills — the project's website /
                // platform / socials, straight off the flyer's links.
                Array.isArray(p.links) && p.links.length > 0 && React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "sec-h" }, "Find it online"),
                  React.createElement("div", { className: "links" },
                    p.links.map((l, i) => React.createElement(LinkPill, { key: i, link: l }))
                  )
                ),
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { style: { marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--line)", textAlign: "center" } },
                    React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "linear-gradient(90deg, #8b0000, #9a5b00, #6b6b00, #0b5a0b, #0b3d6b, #2a1a6b, #5a0b5a)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" } }, "the crew")
                  ),
                  React.createElement("div", { className: "team-pile" },
                    personRow(p.lead.name, p.lead.role, p.lead.userId, "lead", p.lead.image, p.lead.handle),
                    p.team.map((t, i) => personRow(
                      t.name,
                      (t.userId && adminSet.has(t.userId)) ? "Co-lead" : t.role,
                      t.userId, i, t.image, t.handle
                    ))
                  ),
                  // Annotation doubles as the feature's trigger: owners see an
                  // inline "✦ add a co-lead" / "✦ edit" action where visitors
                  // see plain marginalia. Opens the crew manager modal.
                  React.createElement("div", { className: "lead-note", style: { marginTop: 12 } },
                    React.createElement("span", null,
                      coLeads.length
                        ? "// led together" + (coLeadAction ? " ·" : "")
                        : "// project lead" + (coLeadAction ? " ·" : (p.lead.bio ? " · " + p.lead.bio : ""))),
                    coLeadAction && React.createElement("button", {
                      className: "act",
                      onClick: () => setCoLeadsOpen(true),
                    }, "✦ " + (canManageCoLeads ? (coLeads.length ? "edit" : "add a co-lead") : "manage crew"))
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  function roleIcon(title) {
    const t = title.toLowerCase();
    if (t.includes("design") || t.includes("type") || t.includes("visual") || t.includes("illustr")) return "palette";
    if (t.includes("dev") || t.includes("eng") || t.includes("stack") || t.includes("back") || t.includes("front") || t.includes("ios")) return "code";
    if (t.includes("growth") || t.includes("ops") || t.includes("market")) return "sparkle";
    if (t.includes("pm") || t.includes("writer") || t.includes("liaison")) return "flag";
    if (t.includes("qa") || t.includes("test")) return "check";
    if (t.includes("found")) return "startup";
    return "user";
  }

  export { ProjectDetail };
  export default ProjectDetail;
