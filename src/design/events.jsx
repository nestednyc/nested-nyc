/* ============================================================
   NESTED NYC — Events (agenda across NYC campuses)
   Pulls live event rows from Supabase via eventService.getAllEvents.
   The feed reflects exactly what's in the database — an empty database
   renders the empty state, never fabricated content.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { EVENT_TYPES, ETYPE, UNI } from './data'
import { Facepile, CatTag, formatEventDate } from './shared'
import { eventService } from '../services/eventService'

  const { useState, useEffect } = React;

  // Adapt a DB event row to the cork-board UI shape. The fields the card reads
  // (mon/day/weekday slices, time, place, going count, host pill) are derived
  // from columns that already exist on the events table after migrations
  // 20260601000000_add_event_type (event_type) and the base schema.
  function toUiEvent(row) {
    const { mon, day, weekday, dateLabel } = formatEventDate(row.date);
    const d = row.date ? new Date(row.date + 'T00:00:00') : null;
    const valid = d && !isNaN(d.getTime());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = valid ? Math.round((d - today) / (24 * 60 * 60 * 1000)) : null;
    let group = 'Later';
    if (row.is_past) group = 'Past';
    else if (diffDays !== null && diffDays <= 7) group = 'This week';
    else if (diffDays !== null && diffDays <= 14) group = 'Next week';
    return {
      id: row.id,
      type: row.event_type || 'talk',
      title: row.title,
      blurb: row.description || '',
      mon, day, weekday, dateLabel,
      time: row.time || '',
      place: row.location || '',
      host: (row.organization && row.organization.name) || row.organizer_name || 'Nested',
      hostSlug: (row.organization && row.organization.slug) || null,
      uni: null, // future: join the host org → university_id → uni slug for the meta line
      going: row.attendees || 0,
      goingNames: [],
      capacity: row.max_attendees || null,
      group,
      isPast: !!row.is_past,
    };
  }

  function EventCard({ e, going, onRSVP, onOpenOrg, onOpenEvent }) {
    const ty = ETYPE[e.type] || ETYPE.talk;
    const extra = Math.max(0, e.going - (e.goingNames || []).length);
    return (
      React.createElement("div", {
        className: "ev-card grain",
        onClick: () => onOpenEvent && onOpenEvent(e.id),
        style: { cursor: onOpenEvent ? "pointer" : "default" },
      },
        React.createElement("div", { className: "ev-date" },
          React.createElement("div", { className: "mon" }, e.mon),
          React.createElement("div", { className: "day" }, e.day),
          React.createElement("div", { className: "wd" }, e.weekday)
        ),
        React.createElement("div", { className: "ev-main" },
          React.createElement("div", { className: "ev-top" },
            React.createElement(CatTag, { cat: ty }),
            e.hostSlug
              ? React.createElement("button", {
                  className: "ev-host link",
                  onClick: (ev) => { ev.stopPropagation(); onOpenOrg && onOpenOrg(e.hostSlug); },
                  type: "button",
                }, e.host)
              : React.createElement("span", { className: "ev-host" }, e.host)
          ),
          React.createElement("h3", null, e.title),
          e.blurb && React.createElement("p", { className: "ev-blurb" }, e.blurb),
          React.createElement("div", { className: "ev-meta" },
            e.time && React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "clock", size: 15 }), e.time),
            e.place && React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "map", size: 15 }), e.place),
            e.uni && UNI[e.uni] && React.createElement("span", { className: "m" }, React.createElement(Icon, { name: "user", size: 15 }), UNI[e.uni].name)
          )
        ),
        React.createElement("div", { className: "ev-right" },
          React.createElement("div", { className: "ev-going" },
            React.createElement(Facepile, { names: (e.goingNames || []).slice(0, 3), extra }),
            React.createElement("span", { className: "txt" }, e.going + " going")
          ),
          React.createElement("button", {
            className: "rsvp" + (going ? " on" : ""),
            onClick: (ev) => { ev.stopPropagation(); onRSVP(e.id); },
          }, going
            ? [React.createElement(Icon, { name: "check", size: 16, stroke: "var(--paper)", key: "i" }), "Going"]
            : [React.createElement(Icon, { name: "plus", size: 16, key: "i" }), "RSVP"])
        )
      )
    );
  }

  function Events({ rsvped, onRSVP, onOpenOrg, onOpenEvent }) {
    const [type, setType] = useState('all');
    const [events, setEvents] = useState(null); // null = loading; [] = empty
    const [error, setError] = useState('');

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const { data, error: fetchErr } = await eventService.getAllEvents();
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message || 'Could not load events.');
          setEvents([]);
          return;
        }
        // Supabase is the source of truth — show real events, even if there
        // are none yet. (Seed is only used in the offline branch above.)
        setEvents((data || []).map(toUiEvent));
      })();
      return () => { cancelled = true; };
    }, []);

    if (events === null) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "disco-head" },
            React.createElement("div", { className: "head-txt" },
              React.createElement("h1", null, "Loading ", React.createElement("em", null, "events"), "…")
            )
          )
        )
      );
    }

    const list = events.filter((e) => type === 'all' || e.type === type);
    const groups = [];
    list.forEach((e) => {
      let g = groups.find((x) => x.label === e.group);
      if (!g) { g = { label: e.group, items: [] }; groups.push(g); }
      g.items.push(e);
    });

    return (
      React.createElement("div", { className: "discover" },
        React.createElement("div", { className: "disco-head" },
          React.createElement("div", { className: "head-txt" },
            React.createElement("h1", null, "What's ", React.createElement("em", null, "happening"), " on campus"),
            React.createElement("p", { className: "sub" }, "Hackathons, demo days, mixers and workshops across every NYC campus on Nested — one shared calendar.")
          )
        ),
        error && React.createElement("div", { className: "hint", style: { color: "var(--c-startup)" } }, "// " + error),
        React.createElement("div", { className: "ev-filters" },
          React.createElement("button", { className: "chip-filter" + (type === 'all' ? " active" : ""), onClick: () => setType('all') },
            React.createElement(Icon, { name: "calendar", size: 17 }), "All events",
            React.createElement("span", { className: "count" }, events.length)
          ),
          EVENT_TYPES.map((t) => (
            React.createElement("button", { key: t.id, className: "chip-filter" + (type === t.id ? " active" : ""), onClick: () => setType(t.id) },
              React.createElement(Icon, { name: t.icon, size: 17, stroke: type === t.id ? "var(--paper)" : t.color }),
              t.label
            )
          ))
        ),
        React.createElement("div", { className: "events", style: { padding: 0 } },
          list.length === 0
            ? React.createElement("div", { className: "hint", style: { padding: "28px 4px" } }, "No events posted yet — check back soon, or host the first one.")
            : groups.map((g) => (
            React.createElement("div", { className: "day-group", key: g.label },
              React.createElement("div", { className: "day-label" }, g.label, React.createElement("span", { className: "n" }, g.items.length + (g.items.length === 1 ? " event" : " events"))),
              g.items.map((e) => React.createElement(EventCard, { key: e.id, e, going: rsvped.has(e.id), onRSVP, onOpenOrg, onOpenEvent }))
            )
          ))
        )
      )
    );
  }

  export { Events, toUiEvent };
  export default Events;
