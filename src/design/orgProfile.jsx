/* ============================================================
   NESTED NYC — Org profile (public page)
   Banner + logo + .edu verified stamp, bio, links, and the
   org's events split into Upcoming / Past. Owners get
   "Manage" + "Pin an event"; visitors get Follow + links.
   Exports OrgCard + EventRow for reuse (dashboard, event detail).
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ETYPE, UNI, ORG_TYPES, cleanProjectLinks } from './data'
import { Av, Facepile, CatTag, Stamp, UniLogo, StudentTag } from './shared'
import { LinkPill } from './people'
import { postTimeAgo } from './postAdapter'
import { JoinButton, MemberRoster } from './clubJoin'

  // Public links for an org row: the links column, falling back to the legacy
  // website/instagram pair for rows the backfill hasn't reached (old tabs,
  // un-migrated local stacks). cleanProjectLinks is also the safety gate — an
  // owner can PATCH arbitrary JSON into links via PostgREST, so raw rows are
  // never mapped into pills without it (only http(s) urls survive).
  function orgLinks(org) {
    const src = (Array.isArray(org.links) && org.links.length)
      ? org.links
      : [org.website, org.instagram && "https://instagram.com/" + String(org.instagram).replace(/^@+/, "")].filter(Boolean);
    return cleanProjectLinks(src);
  }

  function orgSub(org) {
    const typeLabel = (ORG_TYPES.find((t) => t.id === org.type) || {}).label || "Organization";
    const uniName = org.uni && UNI[org.uni] ? UNI[org.uni].name : null;
    return [typeLabel, uniName].filter(Boolean).join(" · ");
  }

  // Compact org card — used for "Hosted by" links and lists.
  function OrgCard({ org, onOpen, kicker }) {
    return (
      React.createElement("button", { className: "org-card", onClick: () => onOpen && onOpen(org.id), type: "button" },
        React.createElement(Av, { name: org.name, size: 44 }),
        React.createElement("span", { className: "oc-id" },
          kicker && React.createElement("span", { className: "oc-kicker" }, kicker),
          React.createElement("b", null, org.name,
            // Student-founded club: the "Student-run" tag (reads the raw row and
            // the adapted event shape alike). No tick — verification is retired.
            !!(org.student_run || org.studentRun) && React.createElement(StudentTag, null)),
          React.createElement("small", null, orgSub(org))
        ),
        onOpen && React.createElement(Icon, { name: "arrowRight", size: 18, stroke: "var(--ink-faint)" })
      )
    );
  }

  // Compact event list row — used on org profile + dashboard.
  function EventRow({ e, onOpen, trailing }) {
    const ty = ETYPE[e.type] || ETYPE.talk;
    const extra = Math.max(0, e.going - Math.min(3, (e.goingNames || []).length));
    return (
      React.createElement("button", { className: "event-row" + (e.isPast ? " past" : ""), onClick: () => onOpen && onOpen(e.id), type: "button" },
        React.createElement("span", { className: "er-stripe", style: { background: ty.color } }),
        React.createElement("span", { className: "er-date" },
          React.createElement("b", null, e.day),
          React.createElement("small", null, e.mon)
        ),
        React.createElement("span", { className: "er-main" },
          React.createElement("span", { className: "er-top" },
            React.createElement(CatTag, { cat: ty }),
            e.isPast && React.createElement("span", { className: "er-ended" }, "Ended")
          ),
          React.createElement("b", { className: "er-title" }, e.title),
          React.createElement("span", { className: "er-meta" },
            React.createElement(Icon, { name: "clock", size: 13 }), e.time,
            React.createElement("span", { className: "er-dot" }, "·"),
            React.createElement(Icon, { name: "map", size: 13 }), e.place
          )
        ),
        trailing
          ? React.createElement("span", { className: "er-right" }, trailing(e))
          : React.createElement("span", { className: "er-right" },
              React.createElement(Facepile, { names: (e.goingNames || []).slice(0, 3), extra }),
              React.createElement("small", { className: "er-going" }, e.going + " going")
            )
      )
    );
  }

  // Events split into Upcoming / Past as two labeled lists (no sticky tab bar —
  // an org page is usually a handful of events; the segmented control was wrong
  // altitude). Empty → the dashed-paper empty state.
  function OrgEvents({ events, onOpenEvent }) {
    const upcoming = events.filter((e) => !e.isPast);
    const past = events.filter((e) => e.isPast);

    if (!upcoming.length && !past.length) {
      return React.createElement("div", { className: "org-empty" },
        React.createElement(Icon, { name: "calendar", size: 34, stroke: "var(--accent)" }),
        React.createElement("p", null, "No events yet."));
    }

    return (
      React.createElement("div", { className: "org-events" },
        React.createElement("div", { className: "sec-h" }, "Upcoming"),
        upcoming.length
          ? React.createElement("div", { className: "event-list" },
              upcoming.map((e) => React.createElement(EventRow, { key: e.id, e, onOpen: onOpenEvent })))
          : React.createElement("div", { className: "org-empty" }, React.createElement("p", null, "Nothing coming up right now.")),
        past.length > 0 && React.createElement("div", { className: "sec-h", style: { marginTop: 30 } }, "Past"),
        past.length > 0 && React.createElement("div", { className: "event-list" },
          past.map((e) => React.createElement(EventRow, { key: e.id, e, onOpen: onOpenEvent })))
      )
    );
  }

  // The public org page — a campus-colored paper poster pinned to the cork
  // board. Visitor-only (the owner manages from the dashboard; there's no
  // owner variant of this page anymore). Campus identity (color + logo) comes
  // from UNI[org.uni] when the org's university resolves, else the accent.
  // The org's recent board posts — compact notes under the poster.
  function OrgPosts({ posts }) {
    return React.createElement("div", { className: "org-posts" },
      posts.map((p) => React.createElement("div", { className: "org-post", key: p.id },
        p.body && React.createElement("p", null, p.body),
        p.images.length > 0 && React.createElement("div", { className: "org-post-imgs" },
          p.images.slice(0, 4).map((src) => React.createElement("img", { key: src, src, alt: "", loading: "lazy" }))),
        React.createElement("div", { className: "org-post-meta" },
          React.createElement("span", null, postTimeAgo(p.at)),
          p.likes > 0 && React.createElement("span", null, React.createElement(Icon, { name: "heart", size: 12 }), p.likes),
          p.commentCount > 0 && React.createElement("span", null, React.createElement(Icon, { name: "chat", size: 12 }), p.commentCount)
        )
      ))
    );
  }

  // `founder` ({ handle, name, uni }) names who founded a student-run club;
  // `onManage` marks the founder's own page — one "Manage club" CTA replaces
  // Join / Follow.
  function OrgProfile({ org, events = [], posts = [], following, followerCount, canFollow = true, onBack, onOpenEvent, onFollow,
                        membership, canJoin = false, onJoin, members = [], memberCount = null, onOpenPerson,
                        founder = null, onManage }) {
    if (!org) return null;
    const uniObj = org.uni && UNI[org.uni] ? UNI[org.uni] : null;
    const barColor = uniObj ? uniObj.color : "var(--accent)";
    const meta = [orgSub(org), org.location].filter(Boolean).join(" · ");
    const links = orgLinks(org);
    // "Visit site" stays a website affordance — a branded link (Instagram,
    // Linktree…) already says where it goes on its own pill.
    const siteLink = links.find((l) => l.kind === "site") || null;
    // Universities aren't joinable; clubs and other orgs are.
    const joinable = org.type !== "university";
    const joinUrl = typeof org.join_url === "string" && /^https?:\/\//i.test(org.join_url) ? org.join_url : null;
    // A student-founded club wears the "Student-run" tag.
    const studentRun = !!org.student_run;
    const founderUni = founder && founder.uni && UNI[founder.uni] ? UNI[founder.uni].name : null;

    return (
      React.createElement("div", { className: "org-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Back")
        ),

        React.createElement("article", { className: "org-page org-poster grain fade-up" },
          React.createElement("div", { className: "cat-bar", style: { background: barColor } }),

          React.createElement("div", { className: "org-inner" },
            React.createElement("div", { className: "org-headline" },
              uniObj
                ? React.createElement(UniLogo, { uni: uniObj, size: 60, radius: "24%" })
                : React.createElement(Av, { name: org.name, size: 60 }),
              React.createElement("div", { className: "org-id", style: { minWidth: 0 } },
                React.createElement("h1", null, org.name),
                studentRun && React.createElement(StudentTag, null),
                meta && React.createElement("span", { className: "org-sub" }, meta),
                // "Founded by @handle · campus" — opens the founder when a person-
                // opener is wired (students), plain text otherwise (guests).
                founder && founder.handle && React.createElement(onOpenPerson ? "button" : "span", {
                  className: "org-founder",
                  ...(onOpenPerson ? { type: "button", onClick: () => onOpenPerson(founder.handle), title: "Open @" + founder.handle } : {}),
                }, "Founded by ", React.createElement("b", null, "@" + founder.handle), founderUni ? " · " + founderUni : null)
              )
            ),

            org.bio && React.createElement("p", { className: "org-bio" }, org.bio),

            links.length > 0 && React.createElement("div", { className: "org-links" },
              links.map((l, i) => React.createElement(LinkPill, { key: i, link: l }))
            ),

            React.createElement("div", { className: "org-cta" },
              // The founder's own club: one "Manage club" CTA instead of Join / Follow.
              onManage && React.createElement("button", { className: "btn btn-primary", type: "button", onClick: () => onManage(org) },
                React.createElement(Icon, { name: "grid", size: 17, stroke: "var(--paper)" }), "Manage club"),
              !onManage && joinable && canJoin && React.createElement(JoinButton, { membership, onClick: () => onJoin && onJoin(org) }),
              !onManage && canFollow && React.createElement("button", { className: "btn " + (following ? "btn-primary done" : (joinable && canJoin ? "btn-ghost" : "btn-primary")), onClick: () => onFollow && onFollow(org) },
                following
                  ? [React.createElement(Icon, { name: "check", size: 17, stroke: "var(--paper)", key: "i" }), "Following"]
                  : [React.createElement(Icon, { name: "plus", size: 17, stroke: joinable && canJoin ? "currentColor" : "var(--paper)", key: "i" }), "Follow"]),
              joinable && joinUrl && React.createElement("a", { className: "btn btn-ghost", href: joinUrl, target: "_blank", rel: "noreferrer" },
                React.createElement(Icon, { name: "external", size: 16 }), "Sign up on their site"),
              siteLink && !joinUrl && React.createElement("a", { className: "btn btn-ghost", href: siteLink.url, target: "_blank", rel: "noreferrer" },
                React.createElement(Icon, { name: "external", size: 16 }), "Visit site"),
              (followerCount !== null && followerCount !== undefined || memberCount !== null) && React.createElement("span", { className: "org-followers" },
                React.createElement(Icon, { name: "users", size: 14 }),
                followerCount !== null && followerCount !== undefined && [React.createElement("b", { key: "f" }, followerCount), followerCount === 1 ? "follower" : "followers"],
                joinable && memberCount !== null && [followerCount !== null && followerCount !== undefined ? " · " : null, React.createElement("b", { key: "m" }, memberCount), memberCount === 1 ? "member" : "members"])
            ),

            joinable && React.createElement(MemberRoster, { members, count: memberCount, onOpenPerson }),

            posts.length > 0 && React.createElement("div", { className: "org-section" },
              React.createElement("div", { className: "sec-h" }, "On the board"),
              React.createElement(OrgPosts, { posts })
            ),

            React.createElement("div", { className: "org-section" },
              React.createElement(OrgEvents, { events, onOpenEvent })
            )
          )
        )
      )
    );
  }

  export { OrgProfile, OrgCard, EventRow, orgSub };
  export default OrgProfile;
