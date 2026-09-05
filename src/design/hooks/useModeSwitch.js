/* ============================================================
   useModeSwitch — the pixel-resolve curtain around an identity
   switch (student board ↔ club mode).

   Domain-hook pattern: the phase state + timers live here;
   NestedApp renders <ModeCurtain curtain onDone/> as the one
   persistent sibling above the shell swap and hands `switchMode`
   to the shells through the api bag. `switchMode(apply, { into,
   org })` plays the curtain AROUND a navigation:
     cover  (COVER_MS)  — the mosaic paints in over the old screen;
                          input is blocked by the canvas
     apply()            — the shell swap, under full cover
     reveal (REVEAL_MS) — the mosaic falls away off the new screen,
                          which is live underneath the whole time
   The TIMER is the authority: rAF can stall in a hidden tab, so
   the swap never waits on paint (the curtain guarantees coverage
   on its side). Reduced motion, a hidden tab, or no 2D canvas →
   apply() right away — today's hard cut.

   Only the explicit identity choices play it: Manage <club>, the
   org activity rows, Switch to <club>, Back to the board, and a
   club's creation. URL-driven moves (Back / Forward, deep links,
   applyParsed) and in-mode browsing (club mode opening an event
   or a profile falls through to the student shell) stay instant —
   that's browsing, not becoming someone. Cancel points: popstate,
   signOut (before its await), the cross-tab SIGNED_OUT callback.
   ============================================================ */
import React from 'react'
import { COVER_MS, REVEAL_MS } from '../mosaic'

const { useState, useRef, useEffect, useCallback } = React;

// A tap this recent is where the switch came from; older → the chip.
const POINTER_FRESH_MS = 1500;

function reducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch (e) { return false; }
}
function canvasOk() {
  try { const c = document.createElement("canvas"); return !!(c.getContext && c.getContext("2d")); }
  catch (e) { return false; }
}
// Dev-only slow motion for tuning / screenshots: localStorage["nested.dev.switchSlow"] = 4.
function slowFactor() {
  if (!import.meta.env.DEV) return 1;
  try { const v = Number(window.localStorage.getItem("nested.dev.switchSlow")); return v > 0 ? v : 1; }
  catch (e) { return 1; }
}

export function useModeSwitch() {
  // null | { key, phase: "cover" | "reveal", into: "club" | "board", org, origin, slow, tuning }
  const [curtain, setCurtain] = useState(null);
  const pendingRef = useRef(null);
  const phaseRef = useRef(null);
  const coverTimerRef = useRef(0);
  const doneTimerRef = useRef(0);
  const seqRef = useRef(0);
  const pointerRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => { pointerRef.current = { x: e.clientX, y: e.clientY, at: Date.now() }; };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      clearTimeout(coverTimerRef.current);
      clearTimeout(doneTimerRef.current);
    };
  }, []);

  // Stable on purpose: the popstate listener binds it once.
  const cancelSwitch = useCallback(() => {
    clearTimeout(coverTimerRef.current);
    clearTimeout(doneTimerRef.current);
    pendingRef.current = null;
    phaseRef.current = null;
    setCurtain(null);
  }, []);

  const onCurtainDone = useCallback(() => {
    clearTimeout(doneTimerRef.current);
    phaseRef.current = null;
    setCurtain(null);
  }, []);

  function switchMode(apply, { into = "club", org = null, tuning = null } = {}) {
    if (typeof apply !== "function") return;
    if (reducedMotion() || document.hidden || !canvasOk()) { cancelSwitch(); apply(); return; }
    // Re-entry during the cover (input is blocked, so keyboard-only): the newer
    // intent wins and the running cover just continues.
    if (phaseRef.current === "cover" && pendingRef.current) { pendingRef.current = apply; return; }
    clearTimeout(coverTimerRef.current);
    clearTimeout(doneTimerRef.current);
    const slow = slowFactor();
    const coverMs = (tuning && tuning.coverMs > 0 ? tuning.coverMs : COVER_MS) * slow;
    const revealMs = (tuning && tuning.revealMs > 0 ? tuning.revealMs : REVEAL_MS) * slow;
    const key = ++seqRef.current;
    const p = pointerRef.current;
    const origin = p && Date.now() - p.at <= POINTER_FRESH_MS ? { x: p.x, y: p.y } : null;
    pendingRef.current = apply;
    phaseRef.current = "cover";
    setCurtain({ key, phase: "cover", into, org, origin, slow, tuning });
    coverTimerRef.current = setTimeout(() => {
      const fn = pendingRef.current;
      pendingRef.current = null;
      try { if (fn) fn(); }
      finally {
        // Same tick as apply() → one commit: the new shell and the reveal land together.
        phaseRef.current = "reveal";
        setCurtain((c) => (c && c.key === key ? { ...c, phase: "reveal" } : c));
        doneTimerRef.current = setTimeout(() => {
          phaseRef.current = null;
          setCurtain((c) => (c && c.key === key ? null : c));
        }, revealMs + 250);
      }
    }, coverMs);
  }

  return { curtain, switchMode, onCurtainDone, cancelSwitch, resetModeSwitch: cancelSwitch };
}
