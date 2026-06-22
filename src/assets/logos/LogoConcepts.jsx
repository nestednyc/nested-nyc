/**
 * LogoConcepts - Logo-grade mark candidates for Nested NYC
 *
 * All marks are drawn on a 24x24 grid with:
 * - Consistent stroke weights that survive 16px favicon rendering
 * - Rounded caps/joins (curved forms read friendly/safe — bouba effect)
 * - Optical (not mathematical) centering
 *
 * The intertwined marks use SVG masks to cut true over-under weave
 * gaps at each crossing — background-independent, so they invert
 * cleanly on dark and on colored app-icon tiles.
 */

import { useId } from 'react'

export const INDIGO = '#5B4AE6'
export const INK = '#111827'

/** Hook: unique, url()-safe mask id prefix per component instance */
function useMaskId() {
  return useId().replace(/:/g, '')
}

/**
 * Concept D — "Linked Nests"
 * Two rounded-square nests interlocked like chain links, woven
 * over-under. Nesting (containment) + connection (the link) in one
 * mark: partnership between equals.
 */
export function LinkedNestsMark({ size = 24, color = INDIGO }) {
  const id = useMaskId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* B passes over A at (9,15) — cut A there */}
        <mask id={`${id}-a`}>
          <rect width="24" height="24" fill="white" />
          <path d="M9 12.4 V17.6" stroke="black" strokeWidth="5.6" />
        </mask>
        {/* A passes over B at (15,9) — cut B there */}
        <mask id={`${id}-b`}>
          <rect width="24" height="24" fill="white" />
          <path d="M15 6.4 V11.6" stroke="black" strokeWidth="5.6" />
        </mask>
      </defs>
      <rect x="3" y="3" width="12" height="12" rx="4.5" stroke={color} strokeWidth="2.4" mask={`url(#${id}-a)`} />
      <rect x="9" y="9" width="12" height="12" rx="4.5" stroke={color} strokeWidth="2.4" mask={`url(#${id}-b)`} />
    </svg>
  )
}

/**
 * Concept E — "Joined Rings"
 * Two interlocking rings with a dot nested in the shared space:
 * two students connect, and what they build lives in the overlap.
 */
export function JoinedRingsMark({ size = 24, color = INDIGO }) {
  const id = useMaskId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* B passes over A at the bottom crossing (12,17.45) */}
        <mask id={`${id}-a`}>
          <rect width="24" height="24" fill="white" />
          <path d="M9.6 16.4 L14.4 18.5" stroke="black" strokeWidth="5.6" />
        </mask>
        {/* A passes over B at the top crossing (12,6.55) */}
        <mask id={`${id}-b`}>
          <rect width="24" height="24" fill="white" />
          <path d="M9.6 5.5 L14.4 7.6" stroke="black" strokeWidth="5.6" />
        </mask>
      </defs>
      <circle cx="9.5" cy="12" r="6" stroke={color} strokeWidth="2.4" mask={`url(#${id}-a)`} />
      <circle cx="14.5" cy="12" r="6" stroke={color} strokeWidth="2.4" mask={`url(#${id}-b)`} />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  )
}

/**
 * Concept F — "Threaded Nest"
 * A ring threading through a rounded-square nest — a person woven
 * into the structure. The most literal "intertwined + nested" read.
 */
export function ThreadedNestMark({ size = 24, color = INDIGO }) {
  const id = useMaskId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* ring passes over the square's right edge at (17,10.7) */}
        <mask id={`${id}-sq`}>
          <rect width="24" height="24" fill="white" />
          <path d="M14.5 9.95 L19.5 11.5" stroke="black" strokeWidth="5.6" />
        </mask>
        {/* square passes over the ring at its bottom edge (10.7,17) */}
        <mask id={`${id}-ci`}>
          <rect width="24" height="24" fill="white" />
          <path d="M8.2 17 L13.2 17" stroke="black" strokeWidth="5.6" />
        </mask>
      </defs>
      <rect x="4" y="4" width="13" height="13" rx="4.5" stroke={color} strokeWidth="2.4" mask={`url(#${id}-sq)`} />
      <circle cx="15.5" cy="15.5" r="5" stroke={color} strokeWidth="2.4" mask={`url(#${id}-ci)`} />
    </svg>
  )
}

/**
 * Concept A — "Nest Stack"
 * Concentric rounded squares + center dot: three levels of literal nesting.
 * Reads as nest/containment (belonging) AND nested structure (recursion).
 */
export function NestStackMark({ size = 24, color = INDIGO }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3" y="3" width="18" height="18" rx="6"
        stroke={color} strokeWidth="2.4"
      />
      <rect
        x="7.5" y="7.5" width="9" height="9" rx="3.4"
        stroke={color} strokeWidth="2.4"
      />
      <circle cx="12" cy="12" r="1.8" fill={color} />
    </svg>
  )
}

/**
 * Concept B — "n-dot"
 * A custom lowercase n (single stroked path, rounded terminals) whose
 * counter holds a dot — a person/egg inside the nest. Negative-space
 * "aha" mark (FedEx-arrow effect).
 */
export function NDotMark({ size = 24, color = INDIGO, dotColor }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 19 V11 C6 7.5 8.6 5.5 12 5.5 C15.4 5.5 18 7.5 18 11 V19"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15.5" r="2.2" fill={dotColor || color} />
    </svg>
  )
}

/**
 * Concept C — Wordmark
 * "nested" lowercase in Inter 700, tight tracking. The word is symmetric
 * around its two e's (n-e-st-e-d) — both render in indigo while the rest
 * sits in near-black ink. Favicon fallback: the lone "n" tile.
 *
 * Rendered as HTML (Inter is already loaded as a webfont) for crisp text;
 * convert to paths if this concept wins.
 */
export function Wordmark({ height = 32, ink = INK, accent = INDIGO }) {
  const style = {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: `${height}px`,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    color: ink,
    userSelect: 'none',
  }
  return (
    <span style={style}>
      n<span style={{ color: accent }}>e</span>st
      <span style={{ color: accent }}>e</span>d
    </span>
  )
}

/**
 * Lockup - mark + wordmark side by side, for navbar/hero use.
 * `Mark` is one of the mark components above.
 */
export function Lockup({ Mark, markSize = 30, textHeight = 24, color = INDIGO, ink = INK, gap = 10 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: `${gap}px` }}>
      <Mark size={markSize} color={color} />
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: `${textHeight}px`,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: ink,
          userSelect: 'none',
        }}
      >
        nested
      </span>
    </span>
  )
}
