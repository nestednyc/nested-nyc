/* ============================================================
   useEvents — the student's RSVP domain: the set of events I'm
   going to, the plain toggle, and the question sheet that opens
   instead when an event asks something ("I'm going" → answers →
   one RPC that registers + saves). Answers can be edited later
   from the event page. resetEvents() is signOut's slice.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { eventService } from '../../services/eventService'

const { useState } = React;

export function useEvents({ profile, toast, requireAuth }) {
  const [rsvped, setRsvped] = useState(new Set());
  // The answer sheet on screen: { event, initial, editing } or null.
  const [rsvpPrompt, setRsvpPrompt] = useState(null);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpError, setRsvpError] = useState(null);
  // eventId → my answers (loaded on demand for the event page's "Your answers").
  const [myAnswers, setMyAnswers] = useState({});

  // The plain toggle — used directly when an event has no questions, and
  // always for un-RSVP (the registration's cascade drops any answers).
  async function toggleRsvp(id) {
    if (!profile) return requireAuth("Sign in to RSVP");
    const wasOn = rsvped.has(id);
    // Optimistic toggle first so the button reacts instantly. If the
    // service call fails we revert below — the user sees a clear toast.
    setRsvped((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
    if (wasOn) setMyAnswers((m) => { const n = { ...m }; delete n[id]; return n; });
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

  // "I'm going" from anywhere. Needs the event (its questions), not just
  // an id: no questions → the toggle; questions → the sheet. Already going
  // → the toggle (un-RSVP), whatever the event asks.
  function requestRsvp(event) {
    if (!profile) return requireAuth("Sign in to RSVP");
    if (!event || !event.id) return;
    const questions = Array.isArray(event.questions) ? event.questions.filter((q) => q && q.id && q.prompt) : [];
    if (rsvped.has(event.id) || !questions.length) return toggleRsvp(event.id);
    setRsvpError(null);
    setRsvpPrompt({ event, initial: myAnswers[event.id] || {}, editing: false });
  }

  // Re-open the sheet with what I said last time.
  function editRsvpAnswers(event) {
    if (!profile || !event || !event.id) return;
    setRsvpError(null);
    setRsvpPrompt({ event, initial: myAnswers[event.id] || {}, editing: true });
  }

  async function submitRsvp(answers) {
    const ev = rsvpPrompt && rsvpPrompt.event;
    if (!ev) return;
    setRsvpSubmitting(true);
    setRsvpError(null);
    const { data, error } = await eventService.rsvpWithAnswers(ev.id, answers);
    setRsvpSubmitting(false);
    if (error) { setRsvpError(error.message || "Couldn't save your RSVP — try again"); return; }
    const wasGoing = rsvped.has(ev.id);
    setMyAnswers((m) => ({ ...m, [ev.id]: data || answers || {} }));
    setRsvped((s) => new Set(s).add(ev.id));
    setRsvpPrompt(null);
    toast(wasGoing ? "Answers saved" : "You're going — see you there", wasGoing ? "check" : "calendar");
  }

  function cancelRsvpPrompt() {
    setRsvpPrompt(null);
    setRsvpError(null);
  }

  // The event page asks for my answers once it knows I'm going.
  async function loadMyAnswers(eventId) {
    if (!profile || !eventId || myAnswers[eventId] !== undefined || !isSupabaseConfigured()) return;
    const { data } = await eventService.getMyRsvpAnswers(eventId);
    setMyAnswers((m) => (m[eventId] !== undefined ? m : { ...m, [eventId]: data || {} }));
  }

  // signOut's wipe of this domain.
  function resetEvents() {
    setRsvped(new Set());
    setRsvpPrompt(null);
    setRsvpSubmitting(false);
    setRsvpError(null);
    setMyAnswers({});
  }

  return {
    rsvped, setRsvped, toggleRsvp, resetEvents,
    rsvpPrompt, rsvpSubmitting, rsvpError, requestRsvp, editRsvpAnswers, submitRsvp, cancelRsvpPrompt,
    myAnswers, loadMyAnswers,
  };
}
