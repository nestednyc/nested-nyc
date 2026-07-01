/* ============================================================
   keyboardInset — publish the on-screen keyboard height as `--kb`

   Exposes the soft keyboard's height as a CSS custom property `--kb` on the
   document root, so any bottom-pinned UI can sit above it with
   `bottom: calc(… + var(--kb, 0px))`. Used by the onboarding sticky CTA and the
   DM composer.

   Why JS is required: on iOS Safari the keyboard shrinks only the *visual*
   viewport — the layout viewport stays full height, so `position: sticky/fixed`,
   `100dvh`, and the `interactive-widget` viewport hint (which WebKit ignores)
   can't see the keyboard and the bar gets buried behind it. The VisualViewport
   API is the one reliable signal. (Pattern: MDN "Simulating position:
   device-fixed".) On Android the layout viewport resizes with the keyboard, so
   the formula below naturally yields ~0 and nothing double-offsets.
   ============================================================ */

(function installKeyboardInset() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  // No VisualViewport (old browsers / SSR) — pin to 0 so var(--kb) is always defined.
  if (!vv) { root.style.setProperty("--kb", "0px"); return; }

  let queued = false;
  // Skip redundant writes: --kb only changes when the keyboard/zoom state changes,
  // but the visualViewport resize/scroll burst fires many frames. Cache the last
  // value written and only touch the DOM when it actually changes.
  let last = null;
  const write = (v) => { if (v === last) return; last = v; root.style.setProperty("--kb", v); };
  const apply = () => {
    queued = false;
    // Pinch-zoom also shrinks the visual viewport, which would otherwise read as a
    // huge bogus keyboard inset (innerHeight − vv.height) with no keyboard open and
    // shove the sticky bars off-anchor. Only the unzoomed state means "keyboard".
    if (vv.scale > 1) { write("0px"); return; }
    // Keyboard overlap = layout-viewport height − visible height − top offset.
    // offsetTop is non-zero only under pinch-zoom; clamp ≥ 0 and treat sub-pixel
    // jitter (URL-bar settle) as 0 so the bar doesn't twitch.
    const inset = window.innerHeight - vv.height - vv.offsetTop;
    write((inset > 1 ? Math.round(inset) : 0) + "px");
  };
  // Coalesce the burst of resize/scroll events the keyboard fires into one write.
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(apply);
  };

  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  apply();
})();
