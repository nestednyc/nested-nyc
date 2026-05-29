/* ============================================================
   NESTED NYC — Project detail
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { CAT, UNI } from './data'
import { CatTag, Pin, Stamp, Av, Facepile } from './shared'


  function ProjectDetail({ p, saved, joined, onBack, onSave, onRequest, onMessage }) {
    const cat = CAT[p.cat];
    const uni = UNI[p.uni];
    const teamNames = [p.lead.name, ...p.team.map((t) => t.name)];
    const extra = Math.max(0, p.joinedCount - Math.min(3, teamNames.length));

    return (
      React.createElement("div", { className: "detail-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "The board")
        ),

        React.createElement("div", { className: "detail grain fade-up" },
          React.createElement(Pin, null),
          React.createElement("div", { className: "cat-bar", style: { background: cat.color } }),
          React.createElement(Stamp, { size: 96, className: "detail-stamp" }),
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

            React.createElement("div", { className: "detail-cta" },
              React.createElement("button", {
                className: "btn " + (joined ? "btn-primary done" : "btn-primary"), onClick: () => onRequest(p),
              }, joined
                ? [React.createElement(Icon, { name: "check", size: 18, stroke: "var(--paper)", key: "i" }), "Request sent"]
                : [React.createElement(Icon, { name: "plus", size: 18, stroke: "var(--paper)", key: "i" }), "Request to join"]),
              React.createElement("button", { className: "btn btn-ghost", onClick: () => onMessage(p.lead) },
                React.createElement(Icon, { name: "link", size: 17 }), "Contact " + p.lead.name.split(" ")[0])
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
                React.createElement("div", { className: "rail-card lead" },
                  React.createElement("div", { className: "lead-head" },
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
                    React.createElement("span", { className: "kv-t" }, React.createElement("small", null, "Team"), React.createElement("b", null, p.joinedCount + " joined · " + p.roles.filter((r) => r.open).length + " roles open"))
                  )
                ),
                React.createElement("div", { className: "rail-card" },
                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } },
                    React.createElement(Facepile, { names: teamNames.slice(0, 3), extra }),
                    React.createElement("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)" } }, "the crew")
                  ),
                  React.createElement("div", { className: "team-pile" },
                    React.createElement("div", { className: "team-row" },
                      React.createElement(Av, { name: p.lead.name }),
                      React.createElement("span", { className: "t-who" }, React.createElement("b", null, p.lead.name), React.createElement("small", null, "lead · " + p.lead.role))
                    ),
                    p.team.map((t, i) => (
                      React.createElement("div", { className: "team-row", key: i },
                        React.createElement(Av, { name: t.name }),
                        React.createElement("span", { className: "t-who" }, React.createElement("b", null, t.name), React.createElement("small", null, t.role))
                      )
                    ))
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
