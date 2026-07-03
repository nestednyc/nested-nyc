/* ============================================================
   useEvents — the student side of events: my RSVP set + the
   optimistic toggle. Deliberately tiny — student RSVPs and org-side
   event management (useOrg) never meet, so they stay separate.

   Domain-hook pattern: NestedApp stays the composition root; the
   signed-in Promise.all barrier hydrates `rsvped` (setRsvped is
   exposed for it), and resetEvents() is this domain's slice of
   signOut's wipe.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { eventService } from '../../services/eventService'

const { useState } = React;

export function useEvents({ profile, toast, requireAuth }) {
  const [rsvped, setRsvped] = useState(new Set());

  async function toggleRsvp(id) {
    if (!profile) return requireAuth("Sign in to RSVP");
    const wasOn = rsvped.has(id);
    // Optimistic toggle first so the button reacts instantly. If the
    // service call fails we revert below — the user sees a clear toast.
    setRsvped((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
    toast(wasOn ? "RSVP cancelled" : "You're going — see you there", wasOn ? "x" : "calendar");

    if (!isSupabaseConfigured()) return;
    const { error } = wasOn
      ? await eventService.unregisterFromEvent(id)
      : await eventService.registerForEvent(id);
    if (error) {
      setRsvped((s) => { const n = new Set(s); wasOn ? n.add(id) : n.delete(id); return n; });
      toast("RSVP didn't save — " + (error.message || "try again"), "x");
    }
  }

  // signOut's wipe of this domain.
  function resetEvents() {
    setRsvped(new Set());
  }

  return { rsvped, setRsvped, toggleRsvp, resetEvents };
}
