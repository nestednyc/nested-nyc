/* ============================================================
   ModeCurtain — the pixel-resolve between student and club mode.

   One fixed <canvas> above the shell swap: NestedApp renders it
   as the persistent sibling of whichever shell is up, so it
   outlives the swap. Two phases, both timed by useModeSwitch —
   this component only paints:
     cover  — blocks in the destination's colors pop in from where
              you tapped until the screen is a mosaic (input blocked)
     reveal — the new shell is already underneath; blocks fall away
              from the far corners in toward the new identity chip,
              splitting finer as they go (input passes through)
   Colors are the design tokens read off the shell root — never
   literals — the curtain orange (--curtain) leading a club-bound
   switch, cork leading the way back (never a club's or campus's own
   color: those land anywhere on the wheel). Dev tuning: localStorage
   ["nested.dev.switchLead"] = any CSS color swaps the lead. Paint is
   best-effort: a color this engine's canvas can't parse (pre-oklch)
   just drops out of the palette, and if none parse the phases
   paint nothing — the timers still do the switch.
   ============================================================ */
import React from 'react'
import { COVER_MS, REVEAL_MS, buildCover, buildReveal, pickPalette, shade, easeOutCubic } from './mosaic'

const { useRef, useLayoutEffect } = React;

// The identity chip in whichever topbar is up (desktop chip, else the mobile avatar).
function chipPoint() {
  const el = document.querySelector(".topbar .me-chip") || document.querySelector(".topbar .mob-avatar");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// "var(--x)" → the token's value on the shell root (the accent and the surface
// preset live there via rootStyle/rootClass, not on :root); anything else
// passes through as written.
function resolveColor(raw, root) {
  const s = String(raw || "").trim();
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(s);
  if (!m) return s;
  return getComputedStyle(root).getPropertyValue(m[1]).trim();
}

// Does this canvas parse the color? (An engine that doesn't keeps the previous fillStyle.)
function parses(ctx, color) {
  if (!color) return false;
  ctx.fillStyle = "#010203";
  ctx.fillStyle = color;
  return ctx.fillStyle !== "#010203";
}

// Dev-only lead-color override for tuning the club palette (see the header).
function devLead() {
  if (!import.meta.env.DEV) return null;
  try { const v = window.localStorage.getItem("nested.dev.switchLead"); return v && v.trim() ? v.trim() : null; }
  catch (e) { return null; }
}

// ~20 blocks across the short side: 45px on a 1440×900 desktop, 24px on a
// phone — small enough to read as pixels, big enough that the B/4 leaves stay
// whole pixels.
const clampBlock = (v) => Math.max(16, Math.min(96, Math.round(v)));
function blockFor(w, h, tuning) {
  if (tuning && tuning.block > 0) return clampBlock(tuning.block);
  return Math.max(24, Math.min(48, Math.round(Math.min(w, h) / 20)));
}

export function ModeCurtain({ curtain, onDone }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null); // the cover's plan + what's painted, carried into the reveal
  const key = curtain ? curtain.key : 0;
  const phase = curtain ? curtain.phase : null;

  useLayoutEffect(() => {
    if (!curtain) { stateRef.current = null; return undefined; }
    const canvas = canvasRef.current;
    const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return undefined;
    const tuning = curtain.tuning || {};
    const slow = curtain.slow > 0 ? curtain.slow : 1;
    const w = window.innerWidth, h = window.innerHeight;
    let raf = 0;

    // Plan the cover once per key. The effect can meet a key first in the
    // reveal phase (StrictMode remount), and must still cover before it erases.
    let st = stateRef.current;
    if (!st || st.key !== key) {
      canvas.width = w;   // sizing the backing store also clears it
      canvas.height = h;
      const root = document.querySelector(".app") || document.documentElement;
      const pal = pickPalette(curtain.into, { lead: devLead() });
      const colors = pal.colors.map((c) => resolveColor(c, root));
      const weights = pal.weights.map((wt, i) => (parses(ctx, colors[i]) ? wt : 0));
      const seed = key * 7919 + 17;
      const origin = curtain.origin || chipPoint() || { x: w - 40, y: 34 };
      const cover = buildCover({ width: w, height: h, block: blockFor(w, h, tuning), origin, seed, weights, noise: tuning.noise, patch: tuning.patch });
      st = stateRef.current = { key, w, h, cover, colors, weights, painted: new Uint8Array(cover.cells.length) };
    }
    const { cover, colors, weights, painted } = st;
    if (!weights.some(Boolean)) return undefined; // nothing this engine can paint — the timers still switch

    // Paint every unpainted cell whose threshold has passed, batched per color.
    const fillUpTo = (p) => {
      const { cells, order, colors: idx } = cover;
      for (let k = 0; k < colors.length; k++) {
        if (!weights[k]) continue;
        ctx.fillStyle = colors[k];
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < cells.length; i++) {
          if (painted[i] || idx[i] !== k || order[i] > p) continue;
          const c = cells[i];
          ctx.rect(c.x, c.y, c.w, c.h);
          painted[i] = 1;
          any = true;
        }
        if (any) ctx.fill();
      }
    };

    if (phase === "cover") {
      const t0 = performance.now();
      // Paint lands before the hook's timer swaps the shell.
      const dur = (tuning.coverMs > 0 ? tuning.coverMs : COVER_MS) * slow * 0.85;
      const frame = (now) => {
        const p = dur > 0 ? Math.min(1, (now - t0) / dur) : 1;
        fillUpTo(p);
        if (p < 1) raf = requestAnimationFrame(frame);
      };
      frame(t0); // synchronous first frame: the tap's neighbourhood blocks in before the next paint
      return () => cancelAnimationFrame(raf);
    }

    // reveal — whatever rAF didn't get to: the new shell is never seen uncovered.
    fillUpTo(1);
    const chip = chipPoint() || { x: w - 40, y: 34 };
    const { ops } = buildReveal(cover, chip, {
      noise: tuning.noise, levels: tuning.levels, splitLead: tuning.splitLead, jitter: tuning.jitter, shadeStep: tuning.shadeStep,
    });
    const shades = new Map();
    const shadeOf = (colorIdx, dL) => {
      const k = colorIdx + "|" + dL.toFixed(4);
      let v = shades.get(k);
      if (v === undefined) { v = shade(colors[colorIdx], dL); shades.set(k, v); }
      return v;
    };
    let cursor = 0;
    const t0 = performance.now();
    const dur = (tuning.revealMs > 0 ? tuning.revealMs : REVEAL_MS) * slow;
    const frame = (now) => {
      const p = easeOutCubic(dur > 0 ? Math.min(1, (now - t0) / dur) : 1);
      while (cursor < ops.length && ops[cursor].at <= p) {
        const o = ops[cursor++];
        if (o.kind === "fill") { ctx.fillStyle = shadeOf(o.color, o.shade); ctx.fillRect(o.x, o.y, o.w, o.h); }
        else ctx.clearRect(o.x, o.y, o.w, o.h);
      }
      if (cursor < ops.length) raf = requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, w, h); if (onDone) onDone(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [key, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!curtain) return null;
  return React.createElement("canvas", {
    ref: canvasRef, className: "mode-curtain", "data-phase": phase, "aria-hidden": "true", role: "presentation",
  });
}

export default ModeCurtain;
