// e2e/prod-smoke.mjs — post-deploy smoke against real production (nested.social).
// Confirms the deployed build renders the auth entry screen with no JS errors,
// desktop + mobile. (The enrichment preview is DEV-only, so prod only exposes the
// signup screen without a real account.)
//   Run:  BASE_URL=https://nested.social node e2e/prod-smoke.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://nested.social';
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'e2e', 'shots');
const VPS = [
  { tag: 'desktop', width: 1280, height: 900, isMobile: false, hasTouch: false, dsf: 1 },
  { tag: 'mobile',  width: 390,  height: 844, isMobile: true,  hasTouch: true,  dsf: 2 },
];

await mkdir(OUT, { recursive: true });
const b = await chromium.launch();
for (const vp of VPS) {
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.dsf });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(BASE + '/signup', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.onb-signup h1', { timeout: 15000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, `prod-${vp.tag}-signup.png`), fullPage: true });
  console.log(`${vp.tag}: rendered, pageerrors=${errs.length}` + (errs.length ? ' :: ' + errs.join(' | ') : ''));
  await ctx.close();
}
await b.close();
console.log('prod smoke done →', OUT);
