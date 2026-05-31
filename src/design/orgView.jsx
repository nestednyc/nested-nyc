/* ============================================================
   NESTED NYC — Org view (public, slug-based loader)
   Used when a student clicks an event host pill: load the org by
   slug from Supabase and render the public OrgProfile around it.
   The OrgProfile component is shape-agnostic — this wrapper just
   handles fetching + the shape adapter for events into EventRow.
   ============================================================ */
import React from 'react'
import OrgProfile from './orgProfile'
import { orgService } from '../services/orgService'
import { isSupabaseConfigured } from '../lib/supabase'
import { NestedData } from './data'
import { formatEventDate } from './shared'

  const { useState, useEffect } = React;

  function adaptEventForRow(e) {
    const { mon, day } = formatEventDate(e.date);
    return {
      id: e.id,
      type: e.event_type || 'talk',
      title: e.title,
      mon, day,
      time: e.time || '',
      place: e.location || '',
      going: e.attendees || 0,
      goingNames: [],
      isPast: !!e.is_past,
    };
  }

  function OrgView({ slug, onBack, onOpenEvent, onToast }) {
    const [org, setOrg] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    const [following, setFollowing] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setMissing(false);

      // Offline / unconfigured: try the seed orgs by id matching slug.
      if (!isSupabaseConfigured()) {
        const seed = NestedData.ORGANIZATIONS.find((o) => o.id === slug);
        if (cancelled) return;
        if (!seed) { setMissing(true); setLoading(false); return; }
        setOrg(seed);
        setEvents(NestedData.orgEventsOf(NestedData.EVENTS, seed.id));
        setLoading(false);
        return;
      }

      (async () => {
        const { data: orgRow, error: orgErr } = await orgService.getBySlug(slug);
        if (cancelled) return;
        if (orgErr || !orgRow) {
          setMissing(true);
          setLoading(false);
          return;
        }
        setOrg(orgRow);
        const { data: evs } = await orgService.getOrgEvents(orgRow.id);
        if (cancelled) return;
        setEvents((evs || []).map(adaptEventForRow));
        setLoading(false);
      })();

      return () => { cancelled = true; };
    }, [slug]);

    if (loading) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "disco-head" },
            React.createElement("div", { className: "head-txt" },
              React.createElement("h1", null, "Loading…")
            )
          )
        )
      );
    }

    if (missing || !org) {
      return (
        React.createElement("div", { className: "discover" },
          React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("h3", null, "Org not found"),
            React.createElement("p", null, "We couldn't find that organization on Nested."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 18 }, onClick: onBack }, "Back to events")
          )
        )
      );
    }

    return React.createElement(OrgProfile, {
      org,
      events,
      isOwner: false,
      following,
      onBack,
      onOpenEvent,
      onCreateEvent: () => {},
      onFollow: () => {
        setFollowing(true);
        onToast && onToast('Following ' + org.name, 'check');
      },
    });
  }

  export { OrgView };
  export default OrgView;
