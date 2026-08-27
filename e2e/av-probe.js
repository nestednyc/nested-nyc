/* ============================================================
   e2e page module for avatar-cover.mjs — served by Vite dev, so
   bare imports resolve and shared.jsx gets its JSX transform.
   Renders the REAL Av atom (with the app's real styles.css already
   on the host page) into a fixed overlay: one row of photo avatars
   (portrait / landscape / square sources × explicit + CSS sizing)
   plus an initials control. The runner measures each .av span vs
   its <img> box — they must coincide or the circle shows the wrong
   band of the photo instead of a centered cover crop.
   ============================================================ */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Av } from '../src/design/shared.jsx';

// Tri-band test image: top red / middle green / bottom blue, so a correct
// center cover-crop reads green-dominant and a top-aligned natural-aspect
// render reads red-dominant. Data URI keeps the probe network-free.
function band(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const long = Math.max(w, h), third = long / 3;
  const bands = ['#d33', '#3a3', '#33d'];
  bands.forEach((col, i) => {
    g.fillStyle = col;
    if (h >= w) g.fillRect(0, i * third, w, third);
    else g.fillRect(i * third, 0, third, h);
  });
  return c.toDataURL('image/png');
}

export function mount() {
  const cases = [
    { id: 'portrait-34',  img: band(100, 150), size: 34 },
    { id: 'portrait-46',  img: band(100, 150), size: 46 },
    { id: 'landscape-46', img: band(150, 100), size: 46 },
    { id: 'square-46',    img: band(100, 100), size: 46 },
    { id: 'portrait-css', img: band(100, 150) }, // no size prop — .av's CSS 32px
    { id: 'initials',     img: null, size: 46 },
  ];
  const el = document.createElement('div');
  el.id = 'av-probe';
  el.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#fff;padding:24px;display:flex;gap:16px;align-items:flex-start;';
  document.body.appendChild(el);
  createRoot(el).render(React.createElement(React.Fragment, null,
    cases.map((c) => React.createElement('span', { key: c.id, 'data-case': c.id, style: { display: 'inline-flex' } },
      React.createElement(Av, { name: 'Probe Case', img: c.img, size: c.size })))));
  return cases.map((c) => c.id);
}
