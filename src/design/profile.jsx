/* ============================================================
   NESTED NYC — Self profile (full page, inline-editable)
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNI, CAT, FIELDS, SKILLS, LINK_ICON } from './data'
import { ContactLinks } from './people'

  const { useState, useRef, useEffect } = React;

  const MAX_BIO = 280;

  const LINK_KINDS = [
    { key: "github",    label: "GitHub URL",    placeholder: "https://github.com/yourhandle" },
    { key: "portfolio", label: "Portfolio URL", placeholder: "https://yoursite.com" },
    { key: "linkedin",  label: "LinkedIn URL",  placeholder: "https://linkedin.com/in/you" },
    { key: "instagram", label: "Instagram",     placeholder: "@yourhandle" },
  ];

  async function resizePhoto(file, maxWidth = 800) {
    const dataURL = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
    const img = await new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.src = dataURL;
    });
    const scale = Math.min(1, maxWidth / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  }

  // Accept both [{kind,label}] (legacy) and {github,portfolio,...} (new). Return the object.
  function readLinks(profile) {
    const raw = profile && profile.links;
    if (!raw) return {};
    const obj = {};
    if (Array.isArray(raw)) {
      raw.forEach(({ kind, label }) => { if (kind && kind !== "email" && label) obj[kind] = label; });
    } else {
      Object.assign(obj, raw);
    }
    // Discord was retired in favour of Instagram — drop any lingering handle so it
    // never renders or gets re-saved (the DB migration clears it at rest).
    delete obj.discord;
    return obj;
  }

  function Polaroid({ label, src, cap, editable, onPick, onClear }) {
    const inputRef = useRef(null);
    return React.createElement("div", {
      className: "polaroid",
      style: editable ? { cursor: src ? "default" : "pointer", position: "relative" } : { position: "relative" },
      onClick: editable && !src ? () => inputRef.current && inputRef.current.click() : undefined,
    },
      editable && React.createElement("input", {
        type: "file", accept: "image/*", ref: inputRef, style: { display: "none" },
        onChange: (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) onPick(f);
          e.target.value = "";
        },
      }),
      React.createElement("div", { className: "ph" },
        src
          ? React.createElement("img", {
              src, alt: cap || label || "",
              style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
            })
          : React.createElement("span", { className: "pl" }, editable ? "+ pin a snap" : label)
      ),
      (cap || label) && !editable && React.createElement("div", { className: "cap" }, cap || label),
      editable && src && React.createElement("button", {
        title: "Remove photo",
        onClick: (e) => { e.stopPropagation(); onClear(); },
        style: {
          position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%",
          background: "var(--paper)", border: "1.5px solid var(--paper-edge)",
          display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
          boxShadow: "0 2px 5px -2px oklch(0.2 0.02 60/.4)",
        },
      }, React.createElement(Icon, { name: "x", size: 12 })),
      editable && src && React.createElement("button", {
        title: "Replace photo",
        onClick: (e) => { e.stopPropagation(); inputRef.current && inputRef.current.click(); },
        style: {
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          fontFamily: "var(--mono)", fontSize: 10, color: "var(--paper)",
          background: "oklch(0 0 0 / 0.55)", padding: "3px 9px", borderRadius: 4,
          border: 0, cursor: "pointer",
        },
      }, "replace")
    );
  }

  function fmtJoined(ts) {
    if (!ts) return "Recently";
    try {
      return new Date(ts).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch (e) {
      return "Recently";
    }
  }

  function HintLine({ text }) {
    return React.createElement("div", {
      style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)" },
    }, text);
  }

  function Profile({
    profile, pinnedProjects, projectCount, eventCount, connectionCount, joinedAt,
    onBack, onOpenProject, onSaveProfile, onSignOut, startInEdit, onAutoEditConsumed,
  }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    // Fresh from onboarding, land straight in edit mode so the empty fields
    // (bio, snaps, links, what you're shipping) invite filling-out instead of
    // showing a sparse read-only page. One-shot: the ref guards against
    // re-triggering on later prop updates within this mount.
    const didAutoEdit = useRef(false);
    useEffect(() => {
      if (startInEdit && profile && !didAutoEdit.current) {
        didAutoEdit.current = true;
        startEdit();
        if (onAutoEditConsumed) onAutoEditConsumed();
      }
    }, [startInEdit, profile]);

    if (!profile) return null;

    const view = editing && draft ? draft : profile;

    const uniObj = UNI[view.uni] || { name: view.uni || "—", full: view.uni || "—" };
    const photos = view.photos || [];
    const fields = view.fields || view.interests || [];
    const skills = view.skills || [];
    const linksObj = readLinks(view);

    const firstName = view.firstName || "";
    const lastName = view.lastName || "";
    const displayName = (firstName || lastName)
      ? (firstName + (lastName ? " " + lastName : "")).trim()
      : (view.name || "@" + view.username);

    // For the rail "Reach me" view-mode display, build the array of pills:
    // object links → array, plus the email (verified, from onboarding).
    const contactArr = Object.entries(linksObj)
      .filter(([, v]) => v && String(v).trim())
      .map(([kind, label]) => ({ kind, label }));
    if (view.email) contactArr.push({ kind: "email", label: view.email });

    const photoSlots = [0, 1, 2].map((i) => {
      const p = photos[i];
      if (typeof p === "string") return { src: p };
      if (p && p.src) return { src: p.src, cap: p.cap || p.l || "" };
      return { label: (p && p.l) || ("snap " + (i + 1)) };
    });

    function startEdit() {
      const cloned = JSON.parse(JSON.stringify(profile));
      // Normalise legacy fields up-front so draft is always in the new shape.
      if (!cloned.fields && cloned.interests) cloned.fields = cloned.interests;
      if (!cloned.skills) cloned.skills = [];
      if (!cloned.photos) cloned.photos = [];
      // Convert array-shape links to object so the editor only deals with one shape.
      cloned.links = readLinks(cloned);
      setDraft(cloned);
      setEditing(true);
    }
    function cancelEdit() { if (saving) return; setEditing(false); setDraft(null); }
    async function saveEdit() {
      if (!draft || saving) return;
      // strip empty link values before persisting
      const cleanLinks = {};
      Object.entries(draft.links || {}).forEach(([k, v]) => {
        if (v && String(v).trim()) cleanLinks[k] = String(v).trim();
      });
      const toSave = { ...draft, links: cleanLinks };
      // keep legacy interests in sync for backward-compat consumers
      if (toSave.fields) toSave.interests = toSave.fields;
      setSaving(true);
      try {
        const result = onSaveProfile ? await onSaveProfile(toSave) : true;
        if (result === false) {
          // parent surfaced an error — stay in edit mode, keep draft
          return;
        }
        setEditing(false);
        setDraft(null);
      } finally {
        setSaving(false);
      }
    }
    function updateDraft(patch) { setDraft((d) => ({ ...d, ...patch })); }
    function toggleArrayField(field, value) {
      setDraft((d) => {
        const cur = (d[field] || []).slice();
        const i = cur.indexOf(value);
        if (i >= 0) cur.splice(i, 1); else cur.push(value);
        return { ...d, [field]: cur };
      });
    }
    function updateLink(kind, value) {
      setDraft((d) => ({ ...d, links: { ...(d.links || {}), [kind]: value } }));
    }
    async function pickPhoto(i, file) {
      try {
        const src = await resizePhoto(file, 800);
        setDraft((d) => {
          const next = (d.photos || []).slice();
          while (next.length <= i) next.push(null);
          next[i] = { src };
          return { ...d, photos: next };
        });
      } catch (e) {
        // swallow; user retries
      }
    }
    function clearPhoto(i) {
      setDraft((d) => {
        const next = (d.photos || []).slice();
        next[i] = null;
        return { ...d, photos: next };
      });
    }

    // ── inline-input styles tuned to existing typography ──
    const heroInputStyle = {
      fontFamily: "var(--disp)", fontWeight: 800,
      fontSize: "clamp(30px, 4.2vw, 46px)", lineHeight: 1.0, letterSpacing: "-0.025em",
      border: 0, background: "transparent", outline: "none",
      borderBottom: "1.5px dashed var(--paper-edge)",
      padding: "2px 0", color: "var(--ink)", minWidth: 0,
    };
    const yearInputStyle = {
      fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-soft)",
      border: 0, background: "transparent", outline: "none",
      borderBottom: "1.5px dashed var(--paper-edge)", padding: "1px 4px",
      width: 110,
    };
    const monoInputStyle = {
      fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)",
      border: 0, background: "transparent", outline: "none",
      borderBottom: "1.5px dashed var(--paper-edge)", padding: "1px 4px",
    };
    const bioTextareaStyle = {
      fontSize: 18, lineHeight: 1.5, color: "var(--ink-soft)", maxWidth: "60ch",
      fontFamily: "inherit", border: 0, background: "transparent", outline: "none",
      borderBottom: "1.5px dashed var(--paper-edge)", padding: "4px 0",
      width: "100%", resize: "vertical", minHeight: 72,
    };

    const ctaButtons = editing
      ? [
          React.createElement("button", {
            key: "c", className: "btn btn-ghost", onClick: cancelEdit,
            disabled: saving,
            style: saving ? { opacity: 0.5, pointerEvents: "none" } : undefined,
          },
            React.createElement(Icon, { name: "x", size: 17 }), "Cancel"),
          React.createElement("button", {
            key: "s", className: "btn btn-primary", onClick: saveEdit,
            disabled: saving,
            style: saving ? { opacity: 0.65, pointerEvents: "none" } : undefined,
          },
            React.createElement(Icon, { name: saving ? "clock" : "check", size: 18, stroke: "var(--paper)" }),
            saving ? "Saving…" : "Save changes"),
        ]
      : [
          React.createElement("button", { key: "e", className: "btn btn-primary", onClick: startEdit },
            React.createElement(Icon, { name: "pin", size: 18, stroke: "var(--paper)" }), "Edit profile"),
        ];

    return (
      React.createElement("div", { className: "detail-wrap" },
        React.createElement("div", { className: "backbar", style: { justifyContent: "space-between" } },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "The board"),
          onSignOut && !editing && React.createElement("button", {
            className: "ghost-link", onClick: onSignOut,
            style: { fontSize: 13 },
            title: "Sign out of Nested",
          },
            React.createElement(Icon, { name: "x", size: 14 }), "Sign out"
          )
        ),

        React.createElement("div", { className: "detail grain fade-up" },
          React.createElement("div", { className: "cat-bar", style: { background: "var(--accent)" } }),

          React.createElement("div", { className: "detail-inner" },

            // ── PHOTOS ─────────────────────────────────────
            React.createElement("div", { className: "pm-photos", style: { marginBottom: 28 } },
              photoSlots.map((slot, i) => React.createElement(Polaroid, Object.assign({ key: i }, slot, {
                editable: editing,
                onPick: (f) => pickPhoto(i, f),
                onClear: () => clearPhoto(i),
              })))
            ),

            // ── NAME ────────────────────────────────────────
            editing
              ? React.createElement("div", { style: { display: "flex", gap: 18, flexWrap: "wrap" } },
                  React.createElement("input", {
                    className: "fluid-name",
                    style: Object.assign({}, heroInputStyle, { flex: 1, minWidth: 160 }),
                    placeholder: "First", value: firstName,
                    onChange: (e) => updateDraft({ firstName: e.target.value }),
                  }),
                  React.createElement("input", {
                    className: "fluid-name",
                    style: Object.assign({}, heroInputStyle, { flex: 1, minWidth: 160 }),
                    placeholder: "Last", value: lastName,
                    onChange: (e) => updateDraft({ lastName: e.target.value }),
                  })
                )
              : React.createElement("h1", null, displayName),

            // ── META ───────────────────────────────────────
            React.createElement("div", {
              className: "sc-meta",
              style: { marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
            },
              React.createElement("span", null,
                "@" + view.username + " · " + uniObj.name + (view.major ? " · " + view.major : "")
              ),
              editing
                ? React.createElement(React.Fragment, null,
                    React.createElement("span", null, " · "),
                    React.createElement("input", {
                      style: yearInputStyle, placeholder: "year",
                      value: view.year || "",
                      onChange: (e) => updateDraft({ year: e.target.value }),
                    })
                  )
                : (view.year ? React.createElement("span", null, " · " + view.year) : null)
            ),

            // ── BIO ────────────────────────────────────────
            editing
              ? React.createElement("div", { style: { marginTop: 18 } },
                  React.createElement("textarea", {
                    style: bioTextareaStyle,
                    placeholder: "Write a short bio — who you are, what you're into…",
                    value: view.bio || "", rows: 3, maxLength: MAX_BIO,
                    onChange: (e) => updateDraft({ bio: e.target.value }),
                  }),
                  React.createElement("div", {
                    style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", marginTop: 4 },
                  }, "// " + (view.bio || "").length + " / " + MAX_BIO)
                )
              : (view.bio
                ? React.createElement("p", { className: "lede", style: { marginTop: 18 } }, view.bio)
                : React.createElement("div", { style: { marginTop: 18 } },
                    React.createElement(HintLine, { text: "// no bio yet" }))),

            // ── BUILDING ───────────────────────────────────
            editing
              ? React.createElement("div", {
                  style: {
                    marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)",
                    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                  },
                },
                  React.createElement("span", null, "// building "),
                  React.createElement("input", {
                    className: "fluid-sm",
                    style: Object.assign({}, monoInputStyle, { width: 200 }),
                    placeholder: "what you're shipping",
                    value: view.building || "",
                    onChange: (e) => updateDraft({ building: e.target.value }),
                  })
                )
              : (view.building
                ? React.createElement("div", {
                    style: { marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-faint)" },
                  },
                    "// building " + view.building
                  )
                : null),

            // ── CTA ────────────────────────────────────────
            React.createElement.apply(null, [
              "div", { className: "detail-cta" },
            ].concat(ctaButtons)),

            // ── BODY GRID ──────────────────────────────────
            React.createElement("div", { className: "detail-grid" },

              // MAIN COLUMN
              React.createElement("div", null,

                // INTO (fields)
                React.createElement("div", { className: "detail-section" },
                  React.createElement("div", { className: "sec-h" }, "Into"),
                  editing
                    ? React.createElement("div", { className: "chips-grid" },
                        FIELDS.map((t) => {
                          const on = (draft.fields || []).includes(t);
                          return React.createElement("button", {
                            key: t,
                            className: "pick" + (on ? " on accent" : ""),
                            onClick: () => toggleArrayField("fields", t),
                          },
                            on && React.createElement(Icon, { name: "check", size: 13, width: 2.4 }),
                            t
                          );
                        })
                      )
                    : (fields.length
                      ? React.createElement("div", { className: "tags" },
                          fields.map((t, i) => React.createElement("span", { className: "tag2", key: i }, t)))
                      : React.createElement(HintLine, { text: "// nothing here yet" }))
                ),

                // SKILLS
                React.createElement("div", { className: "detail-section" },
                  React.createElement("div", { className: "sec-h" }, "Skills"),
                  editing
                    ? React.createElement("div", { className: "chips-grid" },
                        SKILLS.map((s) => {
                          const on = (draft.skills || []).includes(s);
                          return React.createElement("button", {
                            key: s,
                            className: "pick" + (on ? " on accent" : ""),
                            onClick: () => toggleArrayField("skills", s),
                          },
                            on && React.createElement(Icon, { name: "check", size: 13, width: 2.4 }),
                            s
                          );
                        })
                      )
                    : (skills.length
                      ? React.createElement("div", { className: "tags" },
                          skills.map((s, i) => React.createElement("span", { className: "tag2", key: i }, s)))
                      : React.createElement(HintLine, { text: "// no skills yet" }))
                ),

                // PINNED PROJECTS (read-only, even in edit mode)
                React.createElement("div", { className: "detail-section" },
                  React.createElement("div", { className: "sec-h" }, "Pinned projects"),
                  pinnedProjects && pinnedProjects.length
                    ? React.createElement("div", {
                        style: { display: "flex", flexWrap: "wrap", gap: 14 },
                      },
                        pinnedProjects.map((p) => {
                          const c = CAT[p.cat] || { color: "var(--accent)", label: p.cat || "project" };
                          const uName = (UNI[p.uni] || {}).name || "";
                          return React.createElement("button", {
                            key: p.id, className: "mini-flyer",
                            onClick: () => onOpenProject(p.id),
                            style: { textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit", color: "inherit" },
                          },
                            React.createElement("div", { className: "cat-bar", style: { background: p.flyerColor || c.color } }),
                            React.createElement("b", null, p.title),
                            React.createElement("small", null, uName + (uName && c.label ? " · " : "") + (c.label || ""))
                          );
                        })
                      )
                    : React.createElement("div", null,
                        React.createElement(HintLine, { text: "// you haven't pinned a flyer yet" }),
                        React.createElement("button", {
                          className: "btn btn-ghost", style: { marginTop: 12 }, onClick: onBack,
                        },
                          React.createElement(Icon, { name: "arrowLeft", size: 16 }), "Browse the board"
                        )
                      )
                )
              ),

              // RAIL
              React.createElement("div", { className: "rail" },

                // REACH ME
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "sec-h", style: { marginBottom: 12 } }, "Reach me"),
                  editing
                    ? React.createElement("div", null,
                        LINK_KINDS.map((lk) =>
                          React.createElement("div", { key: lk.key, className: "field", style: { marginBottom: 10 } },
                            React.createElement("label", null, lk.label),
                            React.createElement("div", {
                              className: "input-wrap" + ((linksObj[lk.key] || "").trim() ? " good" : ""),
                              style: { height: 40, padding: "0 12px" },
                            },
                              React.createElement(Icon, { name: LINK_ICON[lk.key] || "link", size: 16 }),
                              React.createElement("input", {
                                style: { fontSize: 13.5 },
                                placeholder: lk.placeholder,
                                value: linksObj[lk.key] || "",
                                onChange: (e) => updateLink(lk.key, e.target.value),
                              })
                            )
                          )
                        ),
                        view.email && React.createElement("div", {
                          className: "links",
                          style: { marginTop: 4 },
                        },
                          React.createElement("span", {
                            className: "linkpill",
                            style: { opacity: 0.75, cursor: "default" },
                          },
                            React.createElement(Icon, { name: "mail", size: 15 }),
                            view.email,
                            React.createElement("span", {
                              style: { fontSize: 9, marginLeft: 4, color: "var(--ink-faint)", fontFamily: "var(--mono)" },
                            }, "(verified)")
                          )
                        )
                      )
                    : (contactArr.length
                      ? React.createElement(ContactLinks, { person: { links: contactArr } })
                      : React.createElement(HintLine, { text: "// no contact links yet" }))
                ),

                // ON THE BOARD
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "sec-h", style: { marginBottom: 8 } }, "On the board"),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "pin", size: 17 })),
                    React.createElement("span", { className: "kv-t" },
                      React.createElement("small", null, "Pinned"),
                      React.createElement("b", null, projectCount + (projectCount === 1 ? " flyer" : " flyers")))
                  ),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "calendar", size: 17 })),
                    React.createElement("span", { className: "kv-t" },
                      React.createElement("small", null, "RSVPs"),
                      React.createElement("b", null, eventCount + (eventCount === 1 ? " event" : " events")))
                  ),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "users", size: 17 })),
                    React.createElement("span", { className: "kv-t" },
                      React.createElement("small", null, "Connections"),
                      React.createElement("b", null, connectionCount + (connectionCount === 1 ? " person" : " people")))
                  ),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "clock", size: 17 })),
                    React.createElement("span", { className: "kv-t" },
                      React.createElement("small", null, "Joined"),
                      React.createElement("b", null, fmtJoined(joinedAt)))
                  )
                ),

                // CAMPUS
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { className: "sec-h", style: { marginBottom: 8 } }, "Campus"),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "map", size: 17 })),
                    React.createElement("span", { className: "kv-t" },
                      React.createElement("small", null, "School"),
                      React.createElement("b", null, uniObj.full || uniObj.name))
                  ),
                  React.createElement("div", { className: "kv" },
                    React.createElement("span", { className: "ic" }, React.createElement(Icon, { name: "flag", size: 17 })),
                    React.createElement("span", { className: "kv-t" },
                      React.createElement("small", null, "Major"),
                      React.createElement("b", null, view.major || "Undeclared"))
                  )
                )
              )
            )
          )
        )
      )
    );
  }

  export { Profile };
  export default Profile;
