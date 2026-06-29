/* ============================================================
   NESTED NYC — Student profile page (/u/:username)
   ============================================================
   Self-fetching by handle — the established orgView (by slug) /
   eventDetail (by id) pattern. Resolves a student_cards row
   case-insensitively → toPerson → the shared PersonProfile body
   inside a backbar + paper page shell. Auth-gating lives in
   NestedApp (accessOf("userProfile") === "student"); in-app
   arrivals pass initialPerson from the loaded People list so the
   skeleton never flashes.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Skeleton } from './shared'
import { PersonProfile } from './people'
import { toPerson } from './peopleAdapter'
import { profileService } from '../services/profileService'
import { isSupabaseConfigured } from '../lib/supabase'

  const { useState, useEffect } = React;

  function PageShell({ onBack, children }) {
    return (
      React.createElement("div", { className: "person-page" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "People")
        ),
        children
      )
    );
  }

  function UserProfile({ username, initialPerson, connected = [], incoming = [], blocked = new Set(), onConnect, onDisconnect, onMessage, onBlock, onUnblock, onBack, viewerId }) {
    const seeded = initialPerson && initialPerson.handle && username &&
      initialPerson.handle.toLowerCase() === String(username).toLowerCase();
    const [person, setPerson] = useState(seeded ? initialPerson : null);
    const [loading, setLoading] = useState(!seeded);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
      // In-app arrivals already carry the card; only deep links fetch.
      if (person && person.handle && person.handle.toLowerCase() === String(username || "").toLowerCase()) {
        setLoading(false); setMissing(false);
        return;
      }
      if (!isSupabaseConfigured()) { setMissing(true); setLoading(false); return; }
      let cancelled = false;
      setLoading(true);
      setMissing(false);
      profileService.getByUsername(username).then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) { setMissing(true); setLoading(false); return; }
        setPerson(toPerson(data));
        setLoading(false);
      });
      return () => { cancelled = true; };
    }, [username]);

    if (loading) {
      return React.createElement(PageShell, { onBack }, React.createElement(Skeleton, { count: 2 }));
    }

    if (missing || !person) {
      return (
        React.createElement(PageShell, { onBack },
          React.createElement("div", { className: "match-empty fade-up" },
            React.createElement("div", { className: "ill" }, React.createElement(Icon, { name: "users", size: 42, stroke: "var(--accent)" })),
            React.createElement("h3", null, "No one's pinned that handle"),
            React.createElement("p", null, "@" + username + " isn't on Nested — the link may be off, or they changed their username."),
            React.createElement("button", { className: "btn btn-primary", style: { marginTop: 22 }, onClick: onBack },
              React.createElement(Icon, { name: "users", size: 16, stroke: "var(--paper)" }), "Browse people")
          )
        )
      );
    }

    const isSelf = viewerId && person.id === viewerId;
    // Messaging no longer requires a connection (gate dropped 2026-06-27 — the
    // server send_message RPC enforces only block + rate-limit now). Any student
    // can DM any other student, so the Message button shows on every profile but
    // your own. `connected` (outgoing only) still drives the Connect toggle.
    const canMessage = !isSelf;
    return (
      React.createElement(PageShell, { onBack },
        React.createElement("article", { className: "profile-modal" },
          React.createElement(PersonProfile, {
            person,
            connected: connected.includes(person.id),
            canMessage,
            showConnect: !isSelf,
            onMessage: () => onMessage && onMessage(person),
            onConnect: (id) => (connected.includes(id)
              ? onDisconnect && onDisconnect(id)
              : onConnect && onConnect(id)),
            isBlocked: !!(person && blocked && blocked.has(person.id)),
            onBlock,
            onUnblock,
          })
        )
      )
    );
  }

  export { UserProfile };
  export default UserProfile;
