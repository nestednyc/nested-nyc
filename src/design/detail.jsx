/* ============================================================
   NESTED NYC — Project detail
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI, isProjectAdmin, statusMeta, STATUSES } from './data'
import { CatTag, Av, Facepile } from './shared'

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
        canEdit && React.createElement("span", { className: "alert-edit" }, React.createElement(Icon, { name: "pin", size: 13 }), "Edit")
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


  function ProjectDetail({ p, profile, saved, joined, requested, onBack, onSave, onRequest, onMessage, onEdit, onUpdateStatus, pendingRequests = [], onApprove, onReject, onOpenProfile }) {
    const cat = CAT[p.cat];
    const uni = UNI[p.uni];
    // teamNames = lead + joiners (for the "crew" facepile); extra counts faces
    // beyond the 3 shown. joinedCount itself is joiners-only (excludes the lead).
    const teamNames = [p.lead.name, ...p.team.map((t) => t.name)];
    const extra = Math.max(0, teamNames.length - 3);
    // Admin (owner or co-admin) edits status/alert inline and sees the edit CTA.
    const isAdmin = isProjectAdmin(p, profile);
    const isOwner = !!(onEdit && isAdmin);
    // Crew + lead rows deep-link to each person's real profile when we know
    // their user id (carried through from team_members.user_id / owner_id).
    const canOpen = typeof onOpenProfile === "function";
    function personRow(name, sub, userId, key) {
      const clickable = canOpen && !!userId;
      return React.createElement("div", {
        className: "team-row" + (clickable ? " clickable" : ""), key,
        onClick: clickable ? () => onOpenProfile(userId) : undefined,
        title: clickable ? "View " + name + "'s profile" : undefined,
      },
        React.createElement(Av, { name }),
        React.createElement("span", { className: "t-who" },
          React.createElement("b", null, name),
          React.createElement("small", null, sub))
      );
    }

    return (
      React.createElement("div", { className: "detail-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "The board")
        ),

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
                ? React.createElement("button", { className: "btn btn-primary", onClick: () => onEdit(p) },
                    React.createElement(Icon, { name: "pin", size: 18, stroke: "var(--paper)" }), "Edit flyer")
                : React.createElement("button", {
                    // `joined` = approved member ("You're in"); `requested` =
                    // pending request ("Request sent"). Both render the green
                    // "done" treatment; only the unjoined state is a live CTA.
                    className: "btn " + (joined || requested ? "btn-primary done" : "btn-primary"), onClick: () => onRequest(p),
                  }, joined
                    ? [React.createElement(Icon, { name: "check", size: 18, stroke: "var(--paper)", key: "i" }), "You're in"]
                    : requested
                      ? [React.createElement(Icon, { name: "clock", size: 18, stroke: "var(--paper)", key: "i" }), "Request sent"]
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
                )
              ),

              // side rail
              React.createElement("div", { className: "rail" },
                // Owner-only: pending join requests with approve / decline.
                isOwner && pendingRequests.length > 0 && React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "sec-h" }, "Requests to join · " + pendingRequests.length),
                  React.createElement("div", { className: "team-pile" },
                    pendingRequests.map((req) => (
                      React.createElement("div", { className: "team-row", key: req.id, style: { alignItems: "flex-start" } },
                        React.createElement(Av, { name: req.name }),
                        React.createElement("span", { className: "t-who", style: { flex: 1 } },
                          React.createElement("b", null, req.name),
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
                React.createElement("div", { className: "rail-card lead" },
                  React.createElement("div", {
                    className: "lead-head" + (canOpen && p.lead.userId ? " clickable" : ""),
                    onClick: canOpen && p.lead.userId ? () => onOpenProfile(p.lead.userId) : undefined,
                    title: canOpen && p.lead.userId ? "View " + p.lead.name + "'s profile" : undefined,
                  },
                    React.createElement(Av, { name: p.lead.name }),
                    React.createElement("span", { className: "who" },
                      React.createElement("b", null, p.lead.name),
                      React.createElement("small", null, p.lead.role)
                    )
                  ),
                  React.createElement("div", { style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 4 } }, "// project lead · " + p.lead.bio)
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
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { style: { marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--line)" } },
                    React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" } }, "the crew")
                  ),
                  React.createElement("div", { className: "team-pile" },
                    personRow(p.lead.name, p.lead.role, p.lead.userId, "lead"),
                    p.team.map((t, i) => personRow(t.name, t.role, t.userId, i))
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
