/* ============================================================
   mosaic — the pure schedule behind the mode-switch curtain.

   modeCurtain.jsx paints it and useModeSwitch times it; this file
   is DOM-free and seeded so `node --test` can pin it down. The
   curtain is a block grid over the viewport: the COVER paints
   cells in from where you tapped (one threshold per cell), then
   the REVEAL erases them from the far corners in toward the new
   identity chip, each block splitting into 2×2 shaded children
   just before it goes (B → B/2 → B/4), so the new screen
   sharpens out of the pixels. Colors are inherited down the
   split, so subdivision changes shape, never hue (each region of
   the screen changes color at most twice per switch).
   ============================================================ */

export const COVER_MS = 140;
export const REVEAL_MS = 380;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => (Number.isFinite(v) ? clamp(v, 0, 1) : 0);

// mulberry32 — a small seeded PRNG: same seed, same mosaic.
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2-D integer hash → [0,1): spatially coherent color patches.
function hash2(a, b, seed) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function easeOutCubic(t) { const u = 1 - clamp01(t); return 1 - u * u * u; }

// The block grid over a width × height viewport; edge cells are clipped.
export function gridCells(width, height, block) {
  const w = Math.max(0, Math.floor(Number(width) || 0));
  const h = Math.max(0, Math.floor(Number(height) || 0));
  const b = Math.max(1, Math.floor(Number(block) || 0) || 1);
  const cells = [];
  if (!w || !h) return cells;
  const cols = Math.ceil(w / b), rows = Math.ceil(h / b);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * b, y = row * b;
      cells.push({ x, y, w: Math.min(b, w - x), h: Math.min(b, h - y), col, row });
    }
  }
  return cells;
}

// Per-cell thresholds in [0,1] — the fraction of the phase at which a cell
// flips. Mixes normalized distance from `point` with seeded noise, then
// RANK-normalizes: flips are spread evenly across the phase, so it lasts
// exactly its duration with no dead frames at either end. `invert` puts the
// far cells first (the reveal clears the corners and converges on the chip).
// A missing / NaN / off-screen point falls back to the viewport center.
export function orderCells(cells, point, { seed = 1, noise = 0.35, invert = false } = {}) {
  const n = cells.length;
  const out = new Float32Array(n);
  if (!n) return out;
  let maxX = 0, maxY = 0;
  for (const c of cells) { if (c.x + c.w > maxX) maxX = c.x + c.w; if (c.y + c.h > maxY) maxY = c.y + c.h; }
  let px = point && Number.isFinite(point.x) ? point.x : NaN;
  let py = point && Number.isFinite(point.y) ? point.y : NaN;
  if (!Number.isFinite(px) || !Number.isFinite(py)) { px = maxX / 2; py = maxY / 2; }
  px = clamp(px, 0, maxX); py = clamp(py, 0, maxY);
  const far = Math.max(Math.hypot(px, py), Math.hypot(maxX - px, py), Math.hypot(px, maxY - py), Math.hypot(maxX - px, maxY - py)) || 1;
  const k = clamp01(noise);
  const rng = mulberry32(seed);
  const score = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const d = Math.hypot(c.x + c.w / 2 - px, c.y + c.h / 2 - py) / far;
    score[i] = (1 - k) * (invert ? 1 - d : d) + k * rng();
  }
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((a, b) => score[a] - score[b] || a - b);
  const denom = Math.max(1, n - 1);
  for (let r = 0; r < n; r++) out[idx[r]] = r / denom;
  return out;
}

// One palette index per cell, weighted. patch×patch cells share a pick so the
// mosaic reads as patches of paper / cork, not confetti — and a `speckle`
// share of cells pick on their own, so the patches have grain like a
// pixelated photo instead of flat slabs.
export function assignColors(cells, weights, { seed = 1, patch = 2, speckle = 0.25 } = {}) {
  const n = cells.length;
  const out = new Uint8Array(n);
  const ws = (Array.isArray(weights) && weights.length ? weights : [1]).map((w) => Math.max(0, Number(w) || 0));
  const total = ws.reduce((a, b) => a + b, 0);
  if (!total) return out;
  const cdf = [];
  let acc = 0;
  for (const w of ws) { acc += w / total; cdf.push(acc); }
  const p = Math.max(1, Math.floor(Number(patch) || 0) || 1);
  const sp = clamp01(speckle);
  for (let i = 0; i < n; i++) {
    const c = cells[i];
    const solo = sp > 0 && hash2(c.col, c.row, seed ^ 0x5bd1e995) < sp;
    const u = solo ? hash2(c.col, c.row, seed * 3 + 1) : hash2(Math.floor(c.col / p), Math.floor(c.row / p), seed);
    let k = 0;
    while (k < cdf.length - 1 && u >= cdf[k]) k++;
    out[i] = k;
  }
  return out;
}

// The cover: the level-0 grid, thresholds spreading from the tap, colors.
export function buildCover({ width, height, block, origin, seed = 1, weights, noise = 0.35, patch = 2, speckle = 0.25 }) {
  const cells = gridCells(width, height, block);
  const order = orderCells(cells, origin, { seed, noise });
  const colors = assignColors(cells, weights, { seed, patch, speckle });
  return { cells, order, colors, seed, width, height, block };
}

// The reveal: a time-sorted op list the painter walks with one cursor.
//   { at, kind: "fill",  x, y, w, h, color, shade, level } — a split paints 4 children (shade = ± step)
//   { at, kind: "clear", x, y, w, h, level }               — a leaf goes
// Each cell splits `splitLead` before its children go; children jitter around
// the parent's time; grandchildren likewise, with lead / jitter / shade halving
// per level. Fills always precede the clears they enable (never a clear before
// its own fill), and ties put fills first, coarser levels first.
export function buildReveal(cover, point, { seed, noise = 0.35, levels = 2, splitLead = 0.18, jitter = 0.12, shadeStep = 0.035 } = {}) {
  const { cells, colors } = cover;
  const orderSeed = seed == null ? cover.seed + 1 : seed;
  const order = orderCells(cells, point, { seed: orderSeed, noise, invert: true });
  const rng = mulberry32(orderSeed * 31 + 7);
  const ops = [];
  const L = Math.max(0, Math.floor(Number(levels) || 0));
  const j = Math.max(0, Number(jitter) || 0);
  const lead = Math.max(0, Number(splitLead) || 0);
  const stepBase = Number(shadeStep) || 0;

  function descend(rect, t, level, notBefore, color, shadeAcc) {
    if (level >= L || rect.w < 2 || rect.h < 2) {
      ops.push({ at: t, kind: "clear", x: rect.x, y: rect.y, w: rect.w, h: rect.h, level });
      return;
    }
    const jj = j / (level + 1);
    const step = stepBase / (level + 1);
    const pattern = [step, -step, -step, step];
    const hw = Math.ceil(rect.w / 2), hh = Math.ceil(rect.h / 2);
    const kids = [];
    let minT = 1;
    let q = 0;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = rect.x + dx * hw, y = rect.y + dy * hh;
        const w = dx ? rect.w - hw : hw, h = dy ? rect.h - hh : hh;
        const sh = shadeAcc + pattern[q++];
        if (w <= 0 || h <= 0) continue;
        const ct = clamp01(t + (rng() - 0.5) * jj);
        if (ct < minT) minT = ct;
        kids.push({ x, y, w, h, t: ct, shade: sh });
      }
    }
    const at = clamp01(Math.max(notBefore, minT - lead / (level + 1)));
    for (const k of kids) {
      ops.push({ at, kind: "fill", x: k.x, y: k.y, w: k.w, h: k.h, color, shade: k.shade, level: level + 1 });
      descend(k, Math.max(k.t, at), level + 1, at, color, k.shade);
    }
  }

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    descend({ x: c.x, y: c.y, w: c.w, h: c.h }, order[i], 0, 0, colors[i], 0);
  }
  ops.sort((a, b) => a.at - b.at || (a.kind === b.kind ? a.level - b.level : a.kind === "fill" ? -1 : 1));
  return { ops, order };
}

// oklch(L C H [/ A]) → lighter / darker by dL (L clamped to [0,1]). Anything
// else — a var() the painter hasn't resolved, a hex — passes through untouched.
export function shade(color, dL) {
  const s = String(color || "").trim();
  const d = Number(dL) || 0;
  const m = /^oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+(?:deg)?)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i.exec(s);
  if (!m || !d) return s;
  let L = m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  L = clamp01(L + d);
  return "oklch(" + L.toFixed(3) + " " + m[2] + " " + m[3] + (m[4] ? " / " + m[4] : "") + ")";
}

// What the blocks are made of — the destination's own colors, tokens only,
// on the board's own materials (paper on cork) so the mosaic reads as the
// board breaking up, not a foreign pattern. "club": the curtain orange
// (--curtain) leads, whatever club you're stepping into — never a club's or
// campus's own color, which can land anywhere on the wheel; paper and cork
// speck. "board": cork leads, with paper and the same orange as specks, so
// the two directions rhyme. `lead` swaps the club lead — the dev tuning
// hook, never prod.
export function pickPalette(into, { lead = null } = {}) {
  if (into === "club") {
    return {
      colors: [lead || "var(--curtain)", "var(--paper)", "var(--cork)", "var(--cork-2)"],
      weights: [0.45, 0.28, 0.17, 0.1],
    };
  }
  return { colors: ["var(--cork)", "var(--paper)", "var(--cork-2)", lead || "var(--curtain)"], weights: [0.45, 0.3, 0.15, 0.1] };
}
