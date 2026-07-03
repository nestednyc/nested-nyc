/* ============================================================
   useOrg — the org owner's working data: their event list, its
   loader, and event create/update. The org IDENTITY (orgAccount)
   deliberately lives in useSession — this hook receives it and
   owns only the content an org manages.

   Domain-hook pattern: NestedApp stays the composition root. The
   eventEdit route's draft lookup + bounce guard stay in the root
   render (render-phase corrections must not move into child scope);
   updateOrgEvent takes the event id as an argument for the same
   reason — the old inline lambda closed over the root-owned
   eventDraftId param. resetOrg() is this domain's slice of signOut's
   wipe (orgAccount itself is cleared by useSession's signOutAuth).
   ============================================================ */
import React from 'react'
import { orgService } from '../../services/orgService'
import { eventService } from '../../services/eventService'

const { useState, useEffect } = React;

export function useOrg({ orgAccount, toast, setRoute, setEventDraftId }) {
  const [orgEvents, setOrgEvents] = useState([]);
  // Starts true: a deep-linked /dashboard/events/:id/edit must not bounce in
  // the one render between orgAccount landing and the loader effect firing.
  // Only read in org context, so the idle-true for students is inert.
  const [orgEventsLoading, setOrgEventsLoading] = useState(true);

  // Load the org's events once when an orgAccount becomes active. Cheap
  // enough to do up front so the dashboard renders the list immediately;
  // refetch on org changes (e.g. after edit save).
  useEffect(() => {
    if (!orgAccount) return;
    let cancelled = false;
    setOrgEventsLoading(true);
    orgService.getOrgEvents(orgAccount.id).then(({ data }) => {
      if (cancelled) return;
      setOrgEvents(data || []);
      setOrgEventsLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgAccount && orgAccount.id]);

  // Pin a new event (hoisted from the EventForm create screen's onSubmit).
  async function createOrgEvent(fields) {
    const { data, error } = await eventService.createEvent({
      ...fields,
      organization_id: orgAccount.id,
    });
    if (error) {
      toast("Couldn't pin event — " + (error.message || "try again"), "x");
      return;
    }
    setOrgEvents((arr) => [data, ...arr]);
    setRoute("orgDashboard");
    toast("Pinned to the calendar", "pin");
  }
  // Save event edits (hoisted from the EventForm edit screen's onSubmit).
  // Takes the id as an argument — the root render passes its eventDraftId.
  async function updateOrgEvent(id, fields) {
    const { data, error } = await eventService.updateEvent(id, fields);
    if (error) {
      toast("Couldn't save — " + (error.message || "try again"), "x");
      return;
    }
    setOrgEvents((arr) => arr.map((e) => e.id === id ? { ...e, ...data } : e));
    setEventDraftId(null);
    setRoute("orgDashboard");
    toast("Event updated", "check");
  }

  // signOut's wipe of this domain (orgAccount is useSession's to clear).
  function resetOrg() {
    setOrgEvents([]);
  }

  return { orgEvents, orgEventsLoading, createOrgEvent, updateOrgEvent, resetOrg };
}
