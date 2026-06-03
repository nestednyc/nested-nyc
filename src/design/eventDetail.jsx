/* ============================================================
   NESTED NYC — Event detail page
   "The Pinned Flyer + Tear-off Ticket"
   ============================================================
   One paper artifact split by a perforation:
   · top half = the flyer (postage-stamp date + headline + split body)
   · bottom half = the ticket stub that "detaches" when you RSVP

   Loads via eventService.getEventWithRegistration + getAttendees
   (Supabase). Handles anon / going / full / past / self-host /
   not-found / loading. Shows real database rows only.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { ETYPE, UNI } from './data'
import { Av, Facepile, Pin, formatEventDate } from './shared'
import { OrgCard } from './orgProfile'
import { eventService } from '../services/eventService'

  const { useState, useEffect, useRef } = React;

  // ──────────────────────────────────────────────────────────────────────
  // Postage stamp — concentric rings + cancellation waves in the event-type
  // ink color. The date sits in the center; an ENDED overstamp lays over the
  // top when the event has already happened.
  // ──────────────────────────────────────────────────────────────────────
  function PostageStamp({ d, color, isPast }) {
    const wd = (d.weekday || '').slice(0, 3).toUpperCase();
    return (
      React.createElement("div", { className: "poststamp", style: { "--type-color": color } },
        React.createElement("svg", { viewBox: "0 0 160 160", xmlns: "http://www.w3.org/2000/svg" },
          // outer dashed ring (the "perforated edge" of the stamp itself)
          React.createElement("circle", { cx: 80, cy: 80, r: 74, fill: "none", stroke: color, strokeWidth: 2.2, strokeDasharray: "3 4", opacity: 0.78 }),
          // inner solid ring
          React.createElement("circle", { cx: 80, cy: 80, r: 60, fill: "none", stroke: color, strokeWidth: 2.4 }),
          // cancellation waves above + below the date
          React.createElement("path", {
            d: "M 14 36 Q 24 30 34 36 T 54 36 T 74 36 T 94 36 T 114 36 T 134 36",
            fill: "none", stroke: color, strokeWidth: 2, opacity: 0.55,
          }),
          React.createElement("path", {
            d: "M 22 124 Q 32 118 42 124 T 62 124 T 82 124 T 102 124 T 122 124 T 142 124",
            fill: "none", stroke: color, strokeWidth: 2, opacity: 0.42,
          }),
          // date
          React.createElement("text", { className: "ps-mon", x: 80, y: 64, textAnchor: "middle" }, d.mon),
          React.createElement("text", { className: "ps-day", x: 80, y: 104, textAnchor: "middle" }, d.day),
          wd && React.createElement("text", { className: "ps-wd", x: 80, y: 116, textAnchor: "middle" }, wd)
        ),
        isPast && React.createElement("div", { className: "ended-stamp" },
          React.createElement("span", null, "ENDED"))
      )
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Normalize a DB event row into the shape the rest of this component reads.
  // The organization is joined on the row; facepile names come from
  // getAttendees separately.
  // ──────────────────────────────────────────────────────────────────────
  function normalize(raw, attendees) {
    if (!raw) return null;

    const org = raw.organization || null;
    const orgName = (org && org.name) || raw.organizer_name || 'Nested';
    const orgSlug = (org && org.slug) || null;
    const orgLogo = (org && org.logo) || null;
    const orgVerified = !!(org && org.verified);
    const orgId = (org && org.id) || null;
    const d = formatEventDate(raw.date);

    return {
      id: raw.id,
      type: raw.event_type || 'talk',
      title: raw.title,
      description: raw.description || '',
      blurb: null,
      d, dateLabel: d.dateLabel,
      time: raw.time || '',
      duration: raw.duration || '',
      location: raw.location || '',
      address: raw.address || '',
      highlights: raw.highlights || [],
      tags: raw.tags || [],
      attendees: typeof raw.attendees === 'number' ? raw.attendees : (raw.going || 0),
      maxAttendees: raw.max_attendees || raw.capacity || null,
      isPast: !!raw.is_past,
      isRegistered: !!raw.isRegistered,
      attendeeNames: attendees && attendees.length
        ? attendees.map((a) => [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || '?')
        : [],
      org: { id: orgId, slug: orgSlug, name: orgName, logo: orgLogo, verified: orgVerified },
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Loading skeleton — tilted blank flyer w/ stamp silhouette + a few lines.
  // ──────────────────────────────────────────────────────────────────────
  function EventDetailSkeleton({ onBack }) {
    return (
      React.createElement("div", { className: "ev-detail-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Events")
        ),
        React.createElement("article", { className: "ev-poster grain" },
          React.createElement("span", { className: "tape left" }),
          React.createElement("span", { className: "tape right" }),
          React.createElement("div", { className: "ev-poster-head" },
            React.createElement("div", { className: "ev-skel stamp" }),
            React.createElement("div", { className: "ev-poster-id" },
              React.createElement("div", { className: "ev-skel line", style: { width: "40%" } }),
              React.createElement("div", { className: "ev-skel title" }),
              React.createElement("div", { className: "ev-skel line", style: { width: "80%" } }),
              React.createElement("div", { className: "ev-skel line", style: { width: "65%" } })
            )
          )
        )
      )
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Empty state — "this flyer's not on the board"
  // ──────────────────────────────────────────────────────────────────────
  function EventDetailMissing({ onBack }) {
    return (
      React.createElement("div", { className: "ev-detail-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Events")
        ),
        React.createElement("div", { className: "ev-missing" },
          React.createElement("div", { className: "ill" },
            React.createElement(Pin, null),
            React.createElement(Icon, { name: "calendar", size: 44, stroke: "var(--accent)" })),
          React.createElement("h3", null, "This flyer's not on the board"),
          React.createElement("p", null, "// the event may have been taken down, or the link's off"),
          React.createElement("button", { className: "btn btn-primary", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 16, stroke: "var(--paper)" }),
            "Back to events")
        )
      )
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // "Who's going" sheet — a scrollable roster pinned over the flyer. Each row
  // is a student going to the event: tap the name/avatar to open their full
  // profile, or hit Connect to link up without leaving the page.
  //
  // Two data shapes feed it: the live `attendees` rows (id + avatar + uni, so
  // rows are clickable + connectable) or, offline, just `names` strings from
  // the seed (shown as a static list — nothing to link to without ids).
  // ──────────────────────────────────────────────────────────────────────
  function AttendeesSheet({ attendees, names, total, connected, selfId, onConnect, onOpenProfile, onClose }) {
    const connSet = new Set(connected || []);
    const rows = (attendees && attendees.length)
      ? attendees.map((a) => ({
          id: a.id,
          name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Student',
          avatar: a.avatar || null,
          uni: (UNI[a.university] && UNI[a.university].name) || '',
        }))
      : (names || []).map((n) => ({ id: null, name: n, avatar: null, uni: '' }));

    const moreCount = Math.max(0, (total || rows.length) - rows.length);

    return (
      React.createElement("div", { className: "scrim", onClick: onClose },
        React.createElement("div", { className: "att-sheet", onClick: (e) => e.stopPropagation() },
          React.createElement("button", { className: "modal-close", onClick: onClose }, React.createElement(Icon, { name: "x", size: 18 })),
          React.createElement("div", { className: "att-head" },
            React.createElement("div", { className: "sec-h" }, "Going"),
            React.createElement("h3", null, (total || rows.length) + " going"),
            React.createElement("p", null, "Tap anyone to see their profile — or connect right here.")
          ),
          rows.length === 0
            ? React.createElement("div", { className: "att-empty" }, "No one's RSVP'd yet. Be the first.")
            : React.createElement("div", { className: "att-list" },
                rows.map((p, i) => {
                  const isSelf = p.id && selfId && p.id === selfId;
                  const isConn = p.id && connSet.has(p.id);
                  const canOpen = !!(p.id && onOpenProfile && !isSelf);
                  return React.createElement("div", {
                    className: "att-row" + (canOpen ? " clickable" : ""),
                    key: p.id || ('n' + i),
                    onClick: canOpen ? () => onOpenProfile(p.id) : undefined,
                  },
                    React.createElement(Av, { name: p.name, img: p.avatar }),
                    React.createElement("div", { className: "att-who" },
                      React.createElement("b", null, p.name, isSelf && React.createElement("span", { className: "att-you" }, "You")),
                      p.uni && React.createElement("small", null, p.uni)
                    ),
                    p.id && !isSelf && onConnect && React.createElement("button", {
                      className: "btn " + (isConn ? "btn-primary done" : "btn-ghost") + " att-connect",
                      onClick: (e) => { e.stopPropagation(); if (!isConn && onConnect) onConnect(p.id); },
                    }, isConn
                      ? [React.createElement(Icon, { name: "check", size: 15, stroke: "var(--paper)", key: "i" }), "Connected"]
                      : [React.createElement(Icon, { name: "heart", size: 15, stroke: "var(--accent)", key: "i" }), "Connect"])
                  );
                }),
                moreCount > 0 && React.createElement("div", { className: "att-more" }, "+ " + moreCount + " more going")
              )
        )
      )
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // The page.
  // ──────────────────────────────────────────────────────────────────────
  function EventDetail({
    eventId,
    profile,
    rsvped,
    orgAccount,
    onBack,
    onRSVP,
    onOpenOrg,
    onEditEvent,
    onSignIn,
    onOpenProfile,
    onConnect,
    connected,
  }) {
    const [raw, setRaw] = useState(null);
    const [attendees, setAttendees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    const [showAttendees, setShowAttendees] = useState(false);
    const ticketRef = useRef(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setMissing(false);

      (async () => {
        // Two fetches in parallel — the event itself and a snapshot of who's
        // going. We don't block on the attendee list; if it 404s we still show
        // the page, just with an empty facepile.
        const [eventRes, attRes] = await Promise.all([
          eventService.getEventWithRegistration(eventId),
          eventService.getAttendees(eventId, 60),
        ]);
        if (cancelled) return;

        if (eventRes.error || !eventRes.data) {
          // Not in the DB → it genuinely doesn't exist. Show the missing state.
          setMissing(true);
          setLoading(false);
          return;
        }
        setRaw(eventRes.data);
        setAttendees(attRes.data || []);
        setLoading(false);
      })();

      return () => { cancelled = true; };
    }, [eventId]);

    if (loading) return React.createElement(EventDetailSkeleton, { onBack });
    if (missing || !raw) return React.createElement(EventDetailMissing, { onBack });

    const ev = normalize(raw, attendees);
    const ty = ETYPE[ev.type] || ETYPE.talk;
    const goingNow = rsvped && rsvped.has(eventId);
    const isOwner = !!(orgAccount && ev.org && orgAccount.id === ev.org.id);
    const isAnon = !profile;
    const cap = ev.maxAttendees;
    const isFull = !!cap && ev.attendees >= cap && !goingNow;
    const pct = cap ? Math.min(100, Math.round((ev.attendees / cap) * 100)) : 0;

    function scrollToTicket() {
      if (ticketRef.current) ticketRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function handleRsvpClick() {
      if (ev.isPast) return;
      if (isAnon) { onSignIn && onSignIn(); return; }
      if (isOwner) { onEditEvent && onEditEvent(eventId); return; }
      if (isFull && !goingNow) return;
      onRSVP && onRSVP(eventId);
    }

    // ─── Right-rail RSVP / state slot ─────────────────────────────────────
    let rsvpSlot;
    if (ev.isPast) {
      rsvpSlot = React.createElement("div", null,
        React.createElement("button", { className: "ev-rsvp-btn", disabled: true }, "Ended"),
        React.createElement("span", { className: "ev-rsvp-cap" }, "// this one's already happened")
      );
    } else if (isOwner) {
      rsvpSlot = React.createElement("div", null,
        React.createElement("button", { className: "ev-rsvp-btn", onClick: handleRsvpClick },
          React.createElement(Icon, { name: "pin", size: 16, stroke: "var(--paper)" }), "Edit event"),
        React.createElement("span", { className: "ev-rsvp-cap" }, "// you host this event")
      );
    } else if (isAnon) {
      rsvpSlot = React.createElement("div", null,
        React.createElement("button", { className: "ev-rsvp-btn", onClick: handleRsvpClick },
          React.createElement(Icon, { name: "arrowRight", size: 16, stroke: "var(--paper)" }), "Sign in to RSVP"),
        React.createElement("span", { className: "ev-rsvp-cap" }, "// students only · .edu required")
      );
    } else if (isFull) {
      rsvpSlot = React.createElement("div", null,
        React.createElement("button", { className: "ev-rsvp-btn", disabled: true }, "Full"),
        React.createElement("span", { className: "ev-rsvp-cap" }, "// at capacity")
      );
    } else if (goingNow) {
      rsvpSlot = React.createElement("div", null,
        React.createElement("button", { className: "ev-rsvp-btn going", onClick: handleRsvpClick },
          React.createElement(Icon, { name: "check", size: 16, stroke: "var(--ink-soft)" }), "Going"),
        React.createElement("button", { className: "ev-see-ticket", onClick: scrollToTicket, style: { display: "block", margin: "9px auto 0" } },
          "see your ticket ↓")
      );
    } else {
      rsvpSlot = React.createElement("div", null,
        React.createElement("button", { className: "ev-rsvp-btn", onClick: handleRsvpClick },
          React.createElement(Icon, { name: "plus", size: 16, stroke: "var(--paper)" }), "RSVP"),
        cap
          ? React.createElement("span", { className: "ev-rsvp-cap" }, "// " + (cap - ev.attendees) + " spots left")
          : React.createElement("span", { className: "ev-rsvp-cap" }, "// no cap · drop in")
      );
    }

    const capCaption = cap
      ? (isFull ? "// at capacity" : "// " + ev.attendees + " / " + cap + " · " + (cap - ev.attendees) + " spots left")
      : "// " + ev.attendees + " going · no cap";

    const facepileNames = (ev.attendeeNames || []).slice(0, 3);
    const facepileExtra = Math.max(0, ev.attendees - facepileNames.length);
    const username = (profile && profile.username) || '';

    return (
      React.createElement("div", { className: "ev-detail-wrap" },
        React.createElement("div", { className: "backbar" },
          React.createElement("button", { className: "back", onClick: onBack },
            React.createElement(Icon, { name: "arrowLeft", size: 17 }), "Events")
        ),

        React.createElement("article", {
          className: "ev-poster grain fade-up" + (ev.isPast ? " past" : ""),
          style: { "--type-color": ty.color, "--type-wash": ty.wash, "--type-ink": ty.ink },
        },
          React.createElement("span", { className: "tape left" }),
          React.createElement("span", { className: "tape right" }),

          // ── HEAD: postage stamp + kicker + org card + title + lede ──
          React.createElement("div", { className: "ev-poster-head" },
            React.createElement(PostageStamp, { d: ev.d, color: ty.color, isPast: ev.isPast }),
            React.createElement("div", { className: "ev-poster-id" },
              React.createElement("div", { className: "ev-kicker" },
                React.createElement("span", null, ty.label),
                React.createElement("span", { className: "k-dot" }),
                React.createElement("span", null, "Hosted by")
              ),
              ev.org.slug && React.createElement("div", { className: "ev-host-slot", style: { marginBottom: 16 } },
                React.createElement(OrgCard, { org: ev.org, onOpen: () => onOpenOrg && onOpenOrg(ev.org.slug) })
              ),
              React.createElement("h1", null, ev.title),
              (ev.blurb || ev.description) && React.createElement("p", { className: "lede" }, ev.blurb || (ev.description.length > 220 ? ev.description.slice(0, 200) + "…" : ev.description))
            )
          ),

          // ── BODY: split grid ──
          React.createElement("div", { className: "ev-poster-grid" },
            // main column
            React.createElement("div", null,
              ev.description && React.createElement("div", { className: "ev-body-section" },
                React.createElement("div", { className: "sec-h" }, "About"),
                React.createElement("p", null, ev.description)
              ),
              ev.highlights.length > 0 && React.createElement("div", { className: "ev-body-section" },
                React.createElement("div", { className: "sec-h" }, "What you'll find"),
                React.createElement("div", { className: "hl-list" },
                  ev.highlights.map((h, i) => React.createElement("div", { className: "hl-item", key: i },
                    React.createElement("span", { className: "hl-mark" }, "✓"),
                    React.createElement("span", null, h)))
                )
              ),
              ev.tags.length > 0 && React.createElement("div", { className: "ev-body-section" },
                React.createElement("div", { className: "sec-h" }, "Tags"),
                React.createElement("div", { className: "tags" },
                  ev.tags.map((t, i) => React.createElement("span", { className: "tag2", key: i }, t))
                )
              )
            ),

            // right rail
            React.createElement("div", { className: "ev-rail" },
              React.createElement("div", { className: "ev-rail-card" },
                React.createElement("div", { className: "sec-h" }, "When"),
                React.createElement("div", { className: "ev-rail-when" },
                  ev.d.weekday ? (ev.d.weekday + ", " + (ev.d.dateLabel || (ev.d.mon + ' ' + ev.d.day))) : ev.dateLabel || (ev.d.mon + ' ' + ev.d.day)),
                React.createElement("span", { className: "ev-rail-sub" },
                  "// " + (ev.time || 'time TBA') + (ev.duration ? (' · ' + ev.duration) : ''))
              ),
              React.createElement("div", { className: "ev-rail-card" },
                React.createElement("div", { className: "sec-h" }, "Where"),
                React.createElement("div", { className: "ev-rail-where" }, ev.location || 'Venue TBA'),
                ev.address && React.createElement("span", { className: "ev-rail-sub" }, "// " + ev.address)
              ),
              (() => {
                const hasRoster = (attendees && attendees.length > 0) || facepileNames.length > 0;
                return React.createElement("div", {
                  className: "ev-rail-card ev-going-card" + (hasRoster ? " clickable" : ""),
                  onClick: hasRoster ? () => setShowAttendees(true) : undefined,
                  role: hasRoster ? "button" : undefined,
                  tabIndex: hasRoster ? 0 : undefined,
                  onKeyDown: hasRoster ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAttendees(true); } } : undefined,
                },
                  React.createElement("div", { className: "ev-going-head" },
                    React.createElement("div", { className: "sec-h" }, "Going"),
                    hasRoster && React.createElement("span", { className: "ev-going-see" }, "see all →")
                  ),
                  React.createElement("div", { className: "ev-going-row" },
                    facepileNames.length > 0 && React.createElement(Facepile, { names: facepileNames, extra: facepileExtra }),
                    React.createElement("span", { className: "txt" }, ev.attendees + " going")
                  ),
                  cap && React.createElement("div", { className: "cap-tape" },
                    React.createElement("div", { className: "cap-tape-fill", style: { width: pct + "%" } })
                  ),
                  React.createElement("span", { className: "cap-tape-cap" }, capCaption)
                );
              })(),
              React.createElement("div", { className: "ev-rail-card" },
                rsvpSlot
              )
            )
          ),

          // ── PERFORATION + TICKET STUB ──
          React.createElement("div", { className: "perf" },
            React.createElement("span", { className: "perf-cap" },
              React.createElement("span", { className: "scissors" }, "✂"),
              "tear here")
          ),

          React.createElement("div", {
            className: "ticket-stub" + (goingNow ? " detached" : "") + (ev.isPast ? " detached" : ""),
            ref: ticketRef,
          },
            ev.isPast && React.createElement("div", { className: "used-stamp" },
              React.createElement("span", null, "USED")),

            React.createElement("div", { className: "ticket-head" },
              React.createElement("span", null, "Nested · Ticket"),
              React.createElement("span", { className: "admit" }, "Admit one")
            ),

            React.createElement("div", { className: "ticket-body" },
              React.createElement("div", null,
                React.createElement("div", { className: "ticket-line" },
                  React.createElement("b", null, ev.d.mon + ' ' + ev.d.day),
                  ev.title),
                React.createElement("div", { className: "ticket-line", style: { marginTop: 4 } },
                  React.createElement("span", null, (ev.time ? ('Doors ' + ev.time) : 'TBA') + (ev.location ? (' · ' + ev.location) : ''))
                ),
                goingNow && username
                  ? React.createElement("div", { className: "ticket-name" }, "Admit · @" + username)
                  : React.createElement("div", { className: "ticket-name empty" }, ev.isPast ? "— ticket archived —" : "your name lands here after you RSVP")
              ),
              React.createElement("div", { className: "ticket-host" },
                React.createElement("b", null, ev.org.name),
                React.createElement("small", null, "Host org")
              )
            ),
            ev.org.name && React.createElement("div", { className: "ticket-wmark" }, ev.org.name)
          )
        ),

        // ── MOBILE STICKY RSVP ──
        // Skipped for past/owner/anon because the inline slot is sufficient and
        // a sticky bar pretending the action is alive would mislead the user.
        !ev.isPast && !isOwner && !isAnon && React.createElement("div", { className: "ev-mobile-rsvp" },
          React.createElement("div", { className: "mr-info" },
            React.createElement("b", null, ev.d.mon + ' ' + ev.d.day + ' · ' + ev.title),
            React.createElement("small", null, (ev.time || 'TBA') + (cap ? (' · ' + (cap - ev.attendees) + ' left') : ''))
          ),
          goingNow
            ? React.createElement("button", { className: "ev-rsvp-btn going", onClick: handleRsvpClick },
                React.createElement(Icon, { name: "check", size: 14, stroke: "var(--ink-soft)" }), "Going")
            : isFull
              ? React.createElement("button", { className: "ev-rsvp-btn", disabled: true }, "Full")
              : React.createElement("button", { className: "ev-rsvp-btn", onClick: handleRsvpClick },
                  React.createElement(Icon, { name: "plus", size: 14, stroke: "var(--paper)" }), "RSVP")
        ),

        // ── WHO'S GOING SHEET ──
        showAttendees && React.createElement(AttendeesSheet, {
          attendees,
          names: ev.attendeeNames,
          total: ev.attendees,
          connected,
          selfId: profile && profile.id,
          onConnect,
          onOpenProfile: onOpenProfile
            ? (id) => { setShowAttendees(false); onOpenProfile(id); }
            : null,
          onClose: () => setShowAttendees(false),
        })
      )
    );
  }

  export { EventDetail };
  export default EventDetail;
