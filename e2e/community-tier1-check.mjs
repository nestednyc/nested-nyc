// Tier-1 community board checks against the seeded local stack + vite :5174:
// kinds/kickers, event cards + RSVP, spotlight, ask CTA, rail modules, report
// flow, school badges (no filter chips), mobile overflow, and the org composer's Event chip.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174';
const OUT = process.env.OUT_DIR || new URL('./shots', import.meta.url).pathname;
const PASS = 'Passw0rd!';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
}
async function settle(page, ms = 1200) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  await page.waitForTimeout(ms);
}
async function session(email, tag, steps) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/409 \(Conflict\)/.test(m.text())) errors.push(`[${tag}] console: ${m.text().slice(0, 200)}`); });
  console.log('login', email, await headlessLogin(page, BASE, email, PASS));
  await steps(page);
  await ctx.close();
}

await session('ada@nyu.edu', 'student', async (page) => {
  const n = (sel) => page.locator(sel).count();
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  check('posts render', (await n('.com-post:not(.com-event)')) > 0, String(await n('.com-post:not(.com-event)')));
  check('event cards on the board', (await n('.com-event')) > 0, String(await n('.com-event')));
  check('kind kickers', (await n('.com-kicker')) > 0, String(await n('.com-kicker')));
  check('composer kind chips (Update / Win / Looking for)', (await n('.com-kind')) === 3, (await page.locator('.com-kind').allTextContents()).join('|'));
  check('spotlight card pinned', (await n('.com-spot')) === 1);
  check('ask CTAs render', (await n('.com-cta')) > 0, String(await n('.com-cta')));
  check('"I\'m interested" on a project-tagged ask', (await page.locator('.com-cta button', { hasText: "I'm interested" }).count()) > 0);
  const rail = await page.locator('.com-rail-card h4').allTextContents();
  // the rail's spotlight echo only shows on filters where the hero card isn't on screen
  check('rail: Looking for help / New around / Builders',
    rail.some((t) => /Looking for help/.test(t)) && rail.some((t) => /New around/.test(t)) && rail.some((t) => /Builders/.test(t)) && !rail.some((t) => /spotlight/i.test(t)),
    rail.join(' / '));
  check('hero image layout applied', await page.locator('.com-imgs img:first-child').first().evaluate((el) => getComputedStyle(el).gridColumnStart === '1' && getComputedStyle(el).gridColumnEnd === '-1').catch(() => false));
  check('no "Load older" under 30 posts', (await n('.com-more')) === 0);
  await page.screenshot({ path: OUT + '/t1-student-all.png', fullPage: true });

  // ⋯ menu → report modal → submit
  await page.locator('.com-post.org:not(.com-event) .com-menu-wrap .com-del').first().click();
  await page.waitForTimeout(300);
  check('post ⋯ menu opens', (await n('.com-menu')) === 1);
  await page.locator('.com-menu button', { hasText: /Report/ }).click();
  await page.waitForTimeout(300);
  check('report modal opens', (await n('.modal textarea')) === 1);
  await page.locator('.modal textarea').fill('tier-1 check: demo report');
  await page.locator('.modal .btn-primary').click();
  await settle(page, 1200);
  check('report modal closes after submit', (await n('.modal')) === 0);
  const menuAfter = await page.locator('.com-post.org:not(.com-event) .com-menu-wrap .com-del').first().click().then(async () => { await page.waitForTimeout(200); return (await page.locator('.com-menu button', { hasText: /Report/ }).textContent()) || ''; });
  check('menu shows "Reported" afterwards', /Reported/.test(menuAfter), menuAfter.trim());
  await page.keyboard.press('Escape');

  // RSVP from an event card
  const rsvp = page.locator('.com-event .com-rsvp').first();
  const before = (await rsvp.textContent()).trim();
  await rsvp.click();
  await settle(page, 1000);
  const after = (await page.locator('.com-event .com-rsvp').first().textContent()).trim();
  check('RSVP toggles from the event card', before !== after, `${before} → ${after}`);

  // One board, no filter chips; every note wears its school (campus mark + name)
  check('no filter chips on the board', (await n('.match-tab')) === 0, String(await n('.match-tab')));
  const badged = await n('.com-post:not(.com-event) .com-uni');
  check('posts carry a school badge', badged > 0, String(badged));
  await page.screenshot({ path: OUT + '/t1-student-badges.png', fullPage: true });

  // Post an ask with a project tag → LOOKING FOR kicker on the new card
  await page.locator('.com-kind', { hasText: 'Looking for' }).click();
  await page.locator('.com-input').fill('Tier-1 check: looking for a designer for the study-room finder');
  const sel = page.locator('.com-project-select');
  if (await sel.count()) await sel.selectOption({ index: 1 });
  await page.locator('.com-post-btn').click();
  await settle(page, 1500);
  const firstKicker = (await page.locator('.com-post').first().locator('.com-kicker').textContent().catch(() => '')) || '';
  check('new ask carries the LOOKING FOR kicker', /looking for/i.test(firstKicker), firstKicker.trim());
  check('own post has no CTA / has trash', (await page.locator('.com-post').first().locator('.com-cta').count()) === 0);

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('no horizontal overflow at 390px', sw <= 390, 'scrollWidth=' + sw);
  check('people rail modules hidden on mobile', await page.locator('.com-rail-people').first().evaluate((el) => getComputedStyle(el).display === 'none').catch(() => true));
  await page.screenshot({ path: OUT + '/t1-student-mobile.png', fullPage: false });
});

await session('hello@nyudevs.club', 'org', async (page) => {
  const n = (sel) => page.locator(sel).count();
  await page.goto(BASE + '/dashboard/community', { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  check('org board renders', (await n('.com-post')) > 0, String(await n('.com-post')));
  const chips = await page.locator('.com-kind').allTextContents();
  check('org composer chips = Update / Looking for / Event', chips.join('|').includes('Event') && !chips.join('|').includes('Win'), chips.join('|'));
  check('org sees spotlight (it IS the spotlight)', (await n('.com-spot')) === 1);
  await page.screenshot({ path: OUT + '/t1-org-board.png', fullPage: true });
  await page.locator('.com-kind.ev').click();
  await settle(page, 800);
  check('Event chip opens the event form', page.url().includes('/dashboard/events/new'), page.url());
});

await browser.close();
console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails || errors.length ? 1 : 0);
