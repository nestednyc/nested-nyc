import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COVER_MS, REVEAL_MS, mulberry32, easeOutCubic, gridCells, orderCells, assignColors,
  buildCover, buildReveal, shade, pickPalette,
} from './mosaic.js';

test('mulberry32: deterministic, in [0,1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  const xs = Array.from({ length: 50 }, () => a());
  const ys = Array.from({ length: 50 }, () => b());
  assert.deepEqual(xs, ys);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.ok(new Set(xs).size > 40, 'not stuck');
  assert.notDeepEqual(xs, Array.from({ length: 50 }, mulberry32(43)));
});

test('easeOutCubic: endpoints, monotonic, clamps', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(2), 1);
  assert.equal(easeOutCubic(NaN), 0);
  let prev = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) { const v = easeOutCubic(t); assert.ok(v >= prev); prev = v; }
});

test('gridCells: tiles the viewport exactly, clips edges, survives junk', () => {
  const cells = gridCells(50, 30, 8);
  assert.equal(cells.length, Math.ceil(50 / 8) * Math.ceil(30 / 8));
  const area = cells.reduce((s, c) => s + c.w * c.h, 0);
  assert.equal(area, 50 * 30);
  // no overlaps: paint every pixel once
  const hit = new Uint8Array(50 * 30);
  for (const c of cells) for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) hit[y * 50 + x]++;
  assert.ok(hit.every((n) => n === 1));
  assert.deepEqual(gridCells(0, 0, 8), []);
  assert.deepEqual(gridCells(NaN, 10, 8), []);
  assert.deepEqual(gridCells(10, 10, 999), [{ x: 0, y: 0, w: 10, h: 10, col: 0, row: 0 }]);
  assert.equal(gridCells(10, 10, 0).length, 100, 'block 0 → 1px cells, never a division by zero');
});

test('orderCells: rank-uniform thresholds in [0,1], deterministic', () => {
  const cells = gridCells(400, 300, 20);
  const r1 = orderCells(cells, { x: 0, y: 0 }, { seed: 7 });
  const r2 = orderCells(cells, { x: 0, y: 0 }, { seed: 7 });
  assert.deepEqual(Array.from(r1), Array.from(r2));
  assert.equal(r1.length, cells.length);
  assert.ok(Array.from(r1).every((v) => v >= 0 && v <= 1));
  assert.equal(Math.min(...r1), 0);
  assert.equal(Math.max(...r1), 1);
  assert.equal(new Set(Array.from(r1)).size, cells.length, 'every rank distinct');
  // uniform: a quarter of the cells flip in each quarter of the phase
  const q = [0, 0, 0, 0];
  for (const v of r1) q[Math.min(3, Math.floor(v * 4))]++;
  for (const n of q) assert.ok(Math.abs(n - cells.length / 4) <= 1, 'uniform quarters ' + q);
});

test('orderCells: origin-aware, and inverted for the reveal', () => {
  const cells = gridCells(600, 400, 20);
  const origin = { x: 590, y: 10 };
  const r = orderCells(cells, origin, { seed: 3, noise: 0.35 });
  const dist = (c) => Math.hypot(c.x + c.w / 2 - origin.x, c.y + c.h / 2 - origin.y);
  const byDist = cells.map((c, i) => ({ d: dist(c), r: r[i] })).sort((a, b) => a.d - b.d);
  const dec = Math.floor(byDist.length / 10);
  const mean = (xs) => xs.reduce((s, x) => s + x.r, 0) / xs.length;
  assert.ok(mean(byDist.slice(0, dec)) < mean(byDist.slice(-dec)), 'near the tap flips first');
  const inv = orderCells(cells, origin, { seed: 3, noise: 0.35, invert: true });
  const byDistInv = cells.map((c, i) => ({ d: dist(c), r: inv[i] })).sort((a, b) => a.d - b.d);
  assert.ok(mean(byDistInv.slice(0, dec)) > mean(byDistInv.slice(-dec)), 'inverted: far corners first, the chip last');
});

test('orderCells: degenerate points and noise extremes never NaN', () => {
  const cells = gridCells(100, 100, 10);
  for (const pt of [null, {}, { x: NaN, y: 4 }, { x: -999, y: 999 }, { x: 50, y: 50 }]) {
    const r = orderCells(cells, pt, { seed: 1 });
    assert.ok(Array.from(r).every(Number.isFinite), 'point ' + JSON.stringify(pt));
  }
  for (const noise of [0, 1, -3, 9, NaN]) {
    const r = orderCells(cells, { x: 0, y: 0 }, { seed: 1, noise });
    assert.ok(Array.from(r).every((v) => v >= 0 && v <= 1), 'noise ' + noise);
  }
  assert.equal(orderCells([], { x: 0, y: 0 }).length, 0);
  assert.deepEqual(Array.from(orderCells(gridCells(5, 5, 5), { x: 0, y: 0 })), [0]);
});

test('assignColors: weighted picks, zero weights skipped, patches share a color, speckle breaks them', () => {
  const cells = gridCells(800, 600, 10);
  const idx = assignColors(cells, [0.6, 0, 0.3, 0.1], { seed: 5, patch: 2, speckle: 0 });
  assert.equal(idx.length, cells.length);
  assert.ok(Array.from(idx).every((k) => k >= 0 && k < 4));
  assert.ok(!Array.from(idx).includes(1), 'a zero-weight color is never picked');
  const counts = [0, 0, 0, 0];
  for (const k of idx) counts[k]++;
  assert.ok(counts[0] > counts[2] && counts[2] > counts[3], 'weights respected ' + counts);
  // patch coherence: every 2×2 cell block shares one index when speckle is off
  const byPos = new Map(cells.map((c, i) => [c.col + ':' + c.row, idx[i]]));
  for (const c of cells) {
    if (c.col % 2 || c.row % 2) continue;
    const k = byPos.get(c.col + ':' + c.row);
    assert.equal(byPos.get((c.col + 1) + ':' + c.row), k);
    assert.equal(byPos.get(c.col + ':' + (c.row + 1)), k);
    assert.equal(byPos.get((c.col + 1) + ':' + (c.row + 1)), k);
  }
  // speckle: some cells break from their patch (default), all of them at 1
  const grain = assignColors(cells, [0.6, 0, 0.3, 0.1], { seed: 5, patch: 2 });
  let broken = 0;
  for (let i = 0; i < cells.length; i++) if (grain[i] !== idx[i]) broken++;
  assert.ok(broken > 0 && broken < cells.length / 2, 'some speckle, not a rewrite: ' + broken);
  const solo = assignColors(cells, [0.6, 0, 0.3, 0.1], { seed: 5, patch: 2, speckle: 1 });
  const solo1 = assignColors(cells, [0.6, 0, 0.3, 0.1], { seed: 5, patch: 1, speckle: 1 });
  assert.deepEqual(Array.from(solo), Array.from(solo1), 'at speckle 1 the patch size is moot');
  assert.ok(!Array.from(solo).includes(1));
  assert.ok(Array.from(assignColors(cells, [], { seed: 1 })).every((k) => k === 0), 'no weights → index 0');
  assert.ok(Array.from(assignColors(cells, [0, 0], { seed: 1 })).every((k) => k === 0), 'all-zero weights → index 0');
});

test('buildCover + buildReveal: ops well-formed, ordered, nested, colors inherited', () => {
  const cover = buildCover({ width: 320, height: 200, block: 40, origin: { x: 10, y: 10 }, seed: 11, weights: [0.5, 0.3, 0.2] });
  assert.equal(cover.cells.length, 8 * 5);
  const { ops, order } = buildReveal(cover, { x: 300, y: 20 }, { levels: 2 });
  assert.equal(order.length, cover.cells.length);
  // 4 + 16 fills and 16 clears per cell
  assert.equal(ops.filter((o) => o.kind === 'fill').length, cover.cells.length * 20);
  assert.equal(ops.filter((o) => o.kind === 'clear').length, cover.cells.length * 16);
  for (let i = 1; i < ops.length; i++) assert.ok(ops[i].at >= ops[i - 1].at, 'sorted by time');
  assert.ok(ops.every((o) => o.at >= 0 && o.at <= 1 && o.w > 0 && o.h > 0));
  // every clear is preceded by a fill of the same rect (its own split) unless it is level 0
  const filled = new Set();
  for (const o of ops) {
    const key = o.x + ',' + o.y + ',' + o.w + ',' + o.h;
    if (o.kind === 'fill') filled.add(key);
    else if (o.level > 0) assert.ok(filled.has(key), 'clear before its fill at ' + key);
  }
  // cleared area == viewport area, no overlaps among leaves
  const hit = new Uint8Array(320 * 200);
  for (const o of ops) if (o.kind === 'clear') for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) hit[y * 320 + x]++;
  assert.ok(hit.every((n) => n === 1), 'leaves tile the viewport exactly once');
  // colors inherited: every fill inside cell i carries colors[i]
  for (const o of ops) {
    if (o.kind !== 'fill') continue;
    const i = cover.cells.findIndex((c) => o.x >= c.x && o.y >= c.y && o.x + o.w <= c.x + c.w && o.y + o.h <= c.y + c.h);
    assert.ok(i >= 0, 'fill inside a cell');
    assert.equal(o.color, cover.colors[i]);
    assert.ok(Math.abs(o.shade) <= 0.035 + 0.0175 + 1e-9);
  }
  // a cell's split precedes its children's leaves
  for (const o of ops) if (o.kind === 'fill' && o.level === 1) {
    const kids = ops.filter((k) => k.kind === 'clear' && k.x >= o.x && k.y >= o.y && k.x + k.w <= o.x + o.w && k.y + k.h <= o.y + o.h);
    assert.ok(kids.every((k) => k.at >= o.at));
  }
});

test('buildReveal: levels 0 is a plain dissolve; tiny cells stop splitting', () => {
  const cover = buildCover({ width: 100, height: 60, block: 20, origin: null, seed: 2, weights: [1] });
  const flat = buildReveal(cover, null, { levels: 0 });
  assert.equal(flat.ops.length, cover.cells.length);
  assert.ok(flat.ops.every((o) => o.kind === 'clear' && o.level === 0));
  const tiny = buildCover({ width: 6, height: 6, block: 3, origin: null, seed: 2, weights: [1] });
  const deep = buildReveal(tiny, null, { levels: 5 });
  assert.ok(deep.ops.every((o) => o.w >= 1 && o.h >= 1));
  const same = buildReveal(cover, { x: 0, y: 0 }, { levels: 2 });
  const again = buildReveal(cover, { x: 0, y: 0 }, { levels: 2 });
  assert.deepEqual(same.ops, again.ops, 'deterministic');
});

test('shade: adjusts oklch lightness, clamps, keeps alpha, passes others through', () => {
  assert.equal(shade('oklch(0.60 0.185 30)', 0.05), 'oklch(0.650 0.185 30)');
  assert.equal(shade(' oklch(0.98 0.01 80 / 0.5) ', -0.03), 'oklch(0.950 0.01 80 / 0.5)');
  assert.equal(shade('oklch(0.99 0.01 80)', 0.5), 'oklch(1.000 0.01 80)');
  assert.equal(shade('oklch(0.01 0.01 80)', -0.5), 'oklch(0.000 0.01 80)');
  assert.equal(shade('oklch(50% 0.1 20deg)', 0.1), 'oklch(0.600 0.1 20deg)');
  assert.equal(shade('oklch(0.60 0.185 30)', 0), 'oklch(0.60 0.185 30)');
  assert.equal(shade('var(--paper)', 0.1), 'var(--paper)');
  assert.equal(shade('#abcdef', 0.1), '#abcdef');
  assert.equal(shade(null, 0.1), '');
});

test('pickPalette: the curtain orange leads a club switch, cork leads the board; tokens only', () => {
  const club = pickPalette('club');
  assert.equal(club.colors[0], 'var(--curtain)');
  assert.ok(club.colors.includes('var(--paper)') && club.colors.includes('var(--cork)'), 'the board\'s own materials');
  assert.ok(!club.colors.some((c) => /^#|300\)$/.test(c)), 'no club or campus identity color');
  assert.equal(club.colors.length, club.weights.length);
  assert.equal(Math.max(...club.weights), club.weights[0], 'the lead color leads');
  assert.equal(pickPalette('club', { lead: 'oklch(0.56 0.20 22)' }).colors[0], 'oklch(0.56 0.20 22)', 'the dev lead override replaces the token');
  const board = pickPalette('board');
  assert.equal(board.colors[0], 'var(--cork)');
  assert.ok(board.colors.includes('var(--curtain)'), 'the way back specks the same orange');
  assert.equal(board.colors.length, board.weights.length);
  assert.ok([...club.colors, ...board.colors].every((c) => /^(var\(--|oklch\()/.test(c)), 'never a hardcoded color');
  assert.ok(COVER_MS > 0 && REVEAL_MS > COVER_MS);
});
