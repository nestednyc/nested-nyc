/**
 * Feature Flags
 * Toggle features for MVP demo
 */

// Nests (communities) feature - hidden for MVP to focus on core Projects experience
export const SHOW_NESTS = false

// People discovery section - hidden for MVP until social/messaging backend exists
// Affects: "People to Connect" on Discover/My Projects, "People at Events" on Events page
export const SHOW_PEOPLE_SECTION = false

// Filters feature - hidden for MVP to reduce cognitive load
// Affects: Filter button on Discover page, /filters route
export const SHOW_FILTERS = false

// Live "Tweaks" dev panel from the design prototype (surface, accent, font, texture, tilt).
// Defaults on in dev so the design can be tuned live; off in production builds.
export const SHOW_TWEAKS = import.meta.env.DEV
