/* ============================================================
   NESTED NYC — Org dashboard (owner control room)
   The page an org account lands on after signing in. A masthead, a
   compact "your public flyer" echo (the owner sees what students see
   without it being a second full page), a Manage panel, a mono
   numbers strip, and the events work-list. The public-facing page
   lives in orgProfile.jsx — this is deliberately a different surface.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Av, OrgMini, formatEventDate } from './shared'
import { EventRow } from './orgProfile'
import { notificationText, groupActivity } from './notificationAdapter'
import { postTimeAgo } from './postAdapter'

  const { useState, useEffect } = React;

  function OrgDashboard({
    org,
    events = [],
    loading,
    onCreateEvent,
    onEditOrg,
    onEditEvent,
    onOpenResponses,
    onOpenCommunity,
    followerCount,
    postCount,
    activity = [],
    unreadActivity = 0,
    onSeenActivity,
    onOpenActivity,
    onSignOut,
    pendingCount = 0,
    memberCount,
    onOpenMembers,
  }) {
    // Seeing the dashboard = seeing the activity: clear the unread marks.
    const [newIds, setNewIds] = useState(null);
    useEffect(() => {
      const fresh = activity.filter((a) => !a.read).map((a) => a.id);
      if (!fresh.length) return;
      setNewIds((prev) => new Set([...(prev || []), ...fresh]));
      if (onSeenActivity) onSeenActivity();
    }, [activity.length, unreadActivity]);
    const recent = groupActivity(activity).slice(0, 6);
    const upcoming = events.filter((e) => !e.is_past);
    const past = events.filter((e) => e.is_past);
    const totalRsvps = events.reduce((acc, e) => acc + (e.attendees || 0), 0);
    const [tab, setTab] = useState('upcoming');
    const list = tab === 'upcoming' ? upcoming : past;
    // Pending orgs can't post until approved; a student-run club is live from day one.
    const canPost = !!(org && (org.verified || org.student_run));

    if (!org) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("h3", null, "No org loaded"),
            React.createElement("p", null, "We couldn't find an org tied to your account. Try signing out and back in."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 18 }, onClick: onSignOut },
              React.createElement(Icon, { name: "arrowRight", size: 16, stroke: "var(--paper)" }), "Sign out")
          )
        )
      );
    }

    return (
      React.createElement("div", { className: "discover" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "Your ", React.createElement("em", null, "dashboard")),
            React.createElement("p", { className: "sub" }, "Run your org, post events to the shared NYC calendar, pin updates to the community board, edit your page.")
          ),
          React.createElement("div", { className: "board-actions" },
            canPost && React.createElement("button", { className: "start-btn", onClick: onCreateEvent },
              React.createElement(Icon, { name: "plus", size: 19, stroke: "var(--paper)" }), "Pin an event")
          )
        ),

        React.createElement("div", { className: "dash-panels fade-up" },
          // Left: the owner's own flyer echo (verified, or a live student-run club)
          // OR the pending notice.
          (org.verified || org.student_run)
            ? React.createElement("div", { className: "dash-panel" },
                React.createElement("div", { className: "panel-h" }, "Your public flyer"),
                React.createElement(OrgMini, { name: org.name, type: org.type, uni: org.uni, bio: org.bio, verified: !!org.verified, studentRun: !!org.student_run }),
                React.createElement("p", { className: "echo-note" }, org.verified ? "↳ this is what students see" : "↳ live as a student-run club · this is what students see")
              )
            : React.createElement("div", { className: "dash-panel pending" },
                React.createElement("div", { className: "panel-h" }, "Pending review"),
                React.createElement("div", { className: "verify-note", style: { marginTop: 0 } },
                  React.createElement(Icon, { name: "clock", size: 22, stroke: "var(--accent)" }),
                  React.createElement("div", null,
                    React.createElement("b", null, "Your flyer isn't on the board yet"),
                    React.createElement("p", null, "Your page and events stay private until we verify your org — usually within a day. Then it goes live and you can pin events.")
                  )
                )
              ),

          // Right: management + the numbers.
          React.createElement("div", { className: "dash-side" },
            React.createElement("div", { className: "dash-panel" },
              React.createElement("div", { className: "panel-h" }, "Manage"),
              React.createElement("button", { className: "manage-row", onClick: onEditOrg },
                React.createElement(Icon, { name: "edit", size: 17 }), "Edit org details",
                React.createElement("span", { className: "arr" }, React.createElement(Icon, { name: "arrowRight", size: 16 }))),
              canPost && React.createElement("button", { className: "manage-row", onClick: onCreateEvent },
                React.createElement(Icon, { name: "plus", size: 17 }), "Pin an event",
                React.createElement("span", { className: "arr" }, React.createElement(Icon, { name: "arrowRight", size: 16 }))),
              canPost && onOpenCommunity && React.createElement("button", { className: "manage-row", onClick: onOpenCommunity },
                React.createElement(Icon, { name: "board", size: 17 }), "Post to the community",
                React.createElement("span", { className: "arr" }, React.createElement(Icon, { name: "arrowRight", size: 16 }))),
              canPost && org.type !== "university" && onOpenMembers && React.createElement("button", { className: "manage-row", onClick: onOpenMembers },
                React.createElement(Icon, { name: "users", size: 17 }), "Applications",
                pendingCount > 0 && React.createElement("span", { className: "manage-badge" }, pendingCount + " pending"),
                React.createElement("span", { className: "arr" }, React.createElement(Icon, { name: "arrowRight", size: 16 })))
            ),
            recent.length > 0 && React.createElement("div", { className: "dash-panel" },
              React.createElement("div", { className: "panel-h" }, "Recent activity"),
              React.createElement("div", { className: "act-list" },
                recent.map((n) => React.createElement("button", { key: n.id, type: "button", className: "act-row" + (newIds && n.ids.some((id) => newIds.has(id)) ? "" : " read"), onClick: () => onOpenActivity && onOpenActivity(n) },
                  React.createElement("span", { className: "act-dot" }),
                  React.createElement(Av, { name: n.actor.name, img: n.actor.avatar || null }),
                  React.createElement("span", { className: "act-txt" },
                    React.createElement("b", null, notificationText(n)),
                    n.kind !== "org_follow" && n.snippet && React.createElement("small", null, n.snippet)),
                  React.createElement("span", { className: "act-time" }, postTimeAgo(n.at))
                ))
              )
            ),
            React.createElement("div", { className: "dash-panel" },
              React.createElement("div", { className: "panel-h" }, "The numbers"),
              React.createElement("div", { className: "num-strip" },
                React.createElement("span", null, React.createElement("b", null, upcoming.length), "upcoming"),
                React.createElement("span", null, React.createElement("b", null, past.length), "past"),
                React.createElement("span", null, React.createElement("b", null, totalRsvps), "RSVPs"),
                React.createElement("span", null, React.createElement("b", null, followerCount == null ? "–" : followerCount), "followers"),
                org.type !== "university" && React.createElement("span", null, React.createElement("b", null, memberCount == null ? "–" : memberCount), "members"),
                React.createElement("span", null, React.createElement("b", null, postCount == null ? "–" : postCount), "posts")
              )
            )
          )
        ),

        React.createElement("div", { className: "org-section", style: { marginTop: 18 } },
          React.createElement("div", { className: "sec-h" }, "Events you've posted"),
          React.createElement("div", { className: "dash-tabs" },
            React.createElement("button", { className: "chip-filter" + (tab === 'upcoming' ? " active" : ""), onClick: () => setTab('upcoming') },
              React.createElement(Icon, { name: "calendar", size: 17 }), "Upcoming",
              upcoming.length > 0 && React.createElement("span", { className: "count" }, upcoming.length)),
            React.createElement("button", { className: "chip-filter" + (tab === 'past' ? " active" : ""), onClick: () => setTab('past') },
              React.createElement(Icon, { name: "clock", size: 17 }), "Past",
              past.length > 0 && React.createElement("span", { className: "count" }, past.length))
          ),

          loading
            ? React.createElement("div", { className: "org-empty" },
                React.createElement("p", null, "Loading…"))
            : list.length
              ? React.createElement("div", { className: "event-list" },
                  list.map((e) => React.createElement(EventRow, {
                    key: e.id,
                    e: toRowShape(e),
                    onOpen: () => onEditEvent && onEditEvent(e.id),
                    // Nested inside the row's <button>, so a span with a role — not a second button.
                    trailing: () => React.createElement("span", {
                      className: "er-going er-going-link", role: "link", tabIndex: 0,
                      title: "See who's going and their answers",
                      onClick: (ev) => { ev.stopPropagation(); onOpenResponses && onOpenResponses(e.id); },
                      onKeyDown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); onOpenResponses && onOpenResponses(e.id); } },
                    }, (e.attendees || 0) + " RSVPs →"),
                  })))
              : React.createElement("div", { className: "org-empty" },
                  React.createElement(Icon, { name: "calendar", size: 34, stroke: "var(--accent)" }),
                  React.createElement("p", null, tab === 'upcoming' ? "No upcoming events yet — pin your first one." : "No past events."),
                  tab === 'upcoming' && canPost && React.createElement("button", { className: "btn btn-primary", style: { marginTop: 14 }, onClick: onCreateEvent },
                    React.createElement(Icon, { name: "plus", size: 16, stroke: "var(--paper)" }), "Pin an event"))
        )
      )
    );
  }

  // Adapt a DB event row to the shape EventRow expects (mon/day strings, etc).
  function toRowShape(dbEvent) {
    const { mon, day } = formatEventDate(dbEvent.date);
    return {
      id: dbEvent.id,
      type: dbEvent.event_type || 'talk',
      title: dbEvent.title,
      mon, day,
      time: dbEvent.time || '',
      place: dbEvent.location || '',
      going: dbEvent.attendees || 0,
      goingNames: [],
      isPast: !!dbEvent.is_past,
    };
  }

  export { OrgDashboard };
  export default OrgDashboard;
