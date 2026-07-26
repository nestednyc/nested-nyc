/**
 * Feature Flags
 */

// Live "Tweaks" dev panel (surface, accent, font, texture, tilt).
// Defaults on in dev so the design can be tuned live; off in production builds.
export const SHOW_TWEAKS = import.meta.env.DEV

// Student-facing Events tab — parked until the first real event is posted;
// flip to true to bring it back. Hides the topbar tab and the back-links into
// the events feed only: /events URLs, the events screen itself, and the org
// dashboard (where that first event gets created) all stay live.
export const SHOW_EVENTS = false
