// e2e/avatar-cover.mjs — verifies photo avatars render as centered cover
// crops: the <img> box must coincide with its .av circle for portrait,
// landscape, and square sources, at explicit and CSS-driven sizes.
//
// Regression guard for the "egg avatar": .av is display:grid, and a grid
// item's percentage height resolves against the auto implicit row — not the
// fixed span — so a non-square photo rendered at its natural aspect ratio,
// top-aligned and clipped. The circle then showed the TOP band of the photo
// (background wall above the head) with the face squeezed into the bottom arc.
//
//   Run:  node e2e/avatar-cover.mjs        (vite dev server must be up)
//   Env:  BASE_URL (default http://localhost:5173), OUT_DIR
//
// Uses /login as the host page (public route, no data needed) and mounts
// e2e/av-probe.js, which renders the real Av atom against the real styles.css.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'e2e', 'shots');
const TOL = 1; // px — allow sub-pixel rounding

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));

  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => import('/e2e/av-probe.js').then((m) => m.mount()));
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#av-probe img')].length > 0 &&
    [...document.querySelectorAll('#av-probe img')].every((i) => i.complete && i.naturalWidth > 0));

  const results = await page.evaluate(() =>
    [...document.querySelectorAll('#av-probe [data-case]')].map((wrap) => {
      const av = wrap.querySelector('.av');
      const img = av.querySelector('img');
      const a = av.getBoundingClientRect();
      const r = { id: wrap.dataset.case, span: [a.width, a.height] };
      if (img) {
        const b = img.getBoundingClientRect();
        r.img = [b.width, b.height];
        r.offset = [b.left - a.left, b.top - a.top];
      }
      return r;
    }));

  let failed = 0;
  for (const r of results) {
    let verdict = 'PASS';
    const detail = [`span ${r.span.map((n) => n.toFixed(1)).join('x')}`];
    if (Math.abs(r.span[0] - r.span[1]) > TOL) { verdict = 'FAIL'; detail.push('span not square'); }
    if (r.img) {
      detail.push(`img ${r.img.map((n) => n.toFixed(1)).join('x')} @ ${r.offset.map((n) => n.toFixed(1)).join(',')}`);
      if (Math.abs(r.img[0] - r.span[0]) > TOL || Math.abs(r.img[1] - r.span[1]) > TOL) { verdict = 'FAIL'; detail.push('img box != span box'); }
      if (Math.abs(r.offset[0]) > TOL || Math.abs(r.offset[1]) > TOL) { verdict = 'FAIL'; detail.push('img not pinned to span origin'); }
    }
    if (verdict === 'FAIL') failed++;
    console.log(`${verdict}  ${r.id.padEnd(14)} ${detail.join(' · ')}`);
  }

  const shot = path.join(OUT, 'avatar-cover.png');
  await page.locator('#av-probe').screenshot({ path: shot });
  console.log(`shot: ${shot}`);
  if (errors.length) console.log('page errors:', errors.join(' | '));

  await browser.close();
  if (failed) { console.log(`\n${failed} case(s) FAILED`); process.exit(1); }
  console.log('\nall avatar cover cases pass');
}

run().catch((e) => { console.error(e); process.exit(1); });
