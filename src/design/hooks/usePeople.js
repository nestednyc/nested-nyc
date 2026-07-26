/* ============================================================
   usePeople — the student directory + connection edges: the ranked
   People list, my outgoing `connected` ids, incoming connections,
   and the connect/disconnect actions.

   Domain-hook pattern: NestedApp stays the composition root. The
   People list itself is hydrated by the root's Promise.all barrier
   (which ranks raw rows via rankPeople BEFORE adapting) — that's why
   setPeople/setConnected/setIncoming are exposed. resetPeople() is
   the connections slice of signOut's wipe (byte-match of the old
   inline resets; wiping `people` too is a flagged follow-up).

   NOTE: `people` is also an input to useMessaging (peer identity
   enrichment + handle resolution) — call usePeople BEFORE
   useMessaging in the root.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { connectionService } from '../../services/connectionService'

const { useState } = React;

export function usePeople({ profile, toast, requireAuth }) {
  const [people, setPeople] = useState([]);
  const [connected, setConnected] = useState([]);
  const [incoming, setIncoming] = useState([]);

  // Connections: optimistic add/remove with revert-on-failure (mirrors
  // toggleSave). People is controlled — it owns no connection state.
  // connect() treats a duplicate (23505) as success and a 0-row delete is a
  // no-op, so redundant calls are harmless.
  async function onConnect(id) {
    if (!profile) return requireAuth("Sign in to connect with students");
    if (connected.includes(id)) return;
    setConnected((arr) => [...arr, id]);
    const p = people.find((x) => x.id === id);
    toast("Connected with " + (p ? p.name.split(" ")[0] : "them") + " — say hi with a message", "heart");
    if (!isSupabaseConfigured()) return;
    const { error } = await connectionService.connect(id);
    if (error) {
      setConnected((arr) => arr.filter((x) => x !== id));
      toast("Couldn't connect — " + (error.message || "try again"), "x");
    }
  }
  async function onDisconnect(id) {
    if (!connected.includes(id)) return;
    setConnected((arr) => arr.filter((x) => x !== id));
    if (!isSupabaseConfigured()) return;
    const { error } = await connectionService.disconnect(id);
    if (error) {
      setConnected((arr) => [...arr, id]);
      toast("Couldn't disconnect — " + (error.message || "try again"), "x");
    }
  }

  // signOut's wipe of this domain — the exact resets the old inline signOut
  // performed (the people list itself was never cleared; follow-up).
  function resetPeople() {
    setConnected([]);
    setIncoming([]);
  }

  // Incoming connections the user hasn't reciprocated yet — drives the bell dot.
  const incomingPending = incoming.filter((p) => !connected.includes(p.id));

  return {
    // directory + edges (setters exposed for the root hydration barrier)
    people, setPeople, connected, setConnected, incoming, setIncoming,
    incomingPending,
    // actions
    onConnect, onDisconnect, resetPeople,
  };
}
