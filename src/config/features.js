/**
 * Feature Flags
 */

// Live "Tweaks" dev panel (surface, accent, font, texture, tilt).
// Defaults on in dev so the design can be tuned live; off in production builds.
export const SHOW_TWEAKS = import.meta.env.DEV
