// e2e/screenshots.mjs — visual sweep of the auth + onboarding-enrichment flows.
//
// Captures each screen in desktop and mobile viewports and records any
// console/page errors, so a reviewer can eyeball "is it straight" before ship.
// The enrichment wizard is reached via its DEV preview (/signup?preview=enrich),
// so this needs only the Vite dev server — no Supabase session required.
//
//   Run:  node e2e/screenshots.mjs
//   Env:  BASE_URL   (default http://localhost:5173)
//         OUT_DIR    (default ./e2e/shots)
//
// Note: with the local Supabase stack down, expect connection-refused console
// errors from background data loads — those are backend-offline noise, not UI
// bugs. What matters here is that the screens render and lay out correctly.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'e2e', 'shots');

const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 900, isMobile: false, hasTouch: false, dsf: 1 },
  { tag: 'mobile',  width: 390,  height: 844, isMobile: true,  hasTouch: true,  dsf: 2 },
];

async function settle(page, ms = 500) {
  try { await page.waitForLoadState('networkidle', { timeout: 4000 }); } catch {}
  await page.waitForTimeout(ms);
}
async function shoot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage });
  console.log('   shot', name);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.dsf,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
    console.log(`\n== ${vp.tag} (${vp.width}x${vp.height}) ==`);

    // --- Auth entry screens (render without a backend session) ---
    await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.onb-signup h1', { timeout: 10000 });
    await settle(page);
    await shoot(page, `${vp.tag}-01-signup-step0`);

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.onb-signup h1', { timeout: 10000 });
    await settle(page);
    await shoot(page, `${vp.tag}-02-signin`);

    await page.goto(`${BASE}/forgot`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await shoot(page, `${vp.tag}-03-forgot`);

    // --- Onboarding enrichment wizard via DEV preview ---
    await page.goto(`${BASE}/signup?preview=enrich`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.onb-actions-enrich', { timeout: 10000 });
    await settle(page);
    // #7 — the wizard must land scrolled to the TOP on mount (title visible).
    // Viewport (non-fullPage) shot captures the actual initial scroll position.
    await shoot(page, `${vp.tag}-04-enrich-step0-viewport`, false);
    await shoot(page, `${vp.tag}-05-enrich-step0-full`);

    // Step 1 (skills). Primary button = "Continue" (enrichNext, client-side).
    await page.click('.onb-actions-enrich .btn.btn-primary');
    await settle(page);
    await shoot(page, `${vp.tag}-06-enrich-step1-skills`);

    // Step 2 (details: bio / building / year / links). #13 flex-wrap shows here.
    await page.click('.onb-actions-enrich .btn.btn-primary');
    await settle(page);
    await shoot(page, `${vp.tag}-07-enrich-step2-details`);

    report.push({ viewport: vp.tag, errors });
    await ctx.close();
  }
  await browser.close();

  console.log('\n=== console/page errors ===');
  for (const r of report) {
    console.log(`${r.viewport}: ${r.errors.length}`);
    r.errors.slice(0, 10).forEach((e) => console.log('   - ' + e));
  }
  console.log('\nScreenshots →', OUT);
}

run().catch((e) => { console.error(e); process.exit(1); });
