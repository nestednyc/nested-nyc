// Screenshots of the seeded community demo: student board + /saved,
// an org page with Follow, and the org-side board. Local stack + vite :5174.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174';
const OUT = process.env.OUT_DIR || new URL('./shots', import.meta.url).pathname;
const PASS = 'Passw0rd!';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
async function session(email, steps) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${email}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${email}] console: ${m.text().slice(0, 200)}`); });
  const r = await headlessLogin(page, BASE, email, PASS);
  console.log('login', email, r);
  await steps(page);
  await ctx.close();
}
async function settle(page, ms = 1500) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  await page.waitForTimeout(ms);
}

await session('ada@nyu.edu', async (page) => {
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  console.log('url', page.url(), '| posts:', await page.locator('.com-post').count(), '| org posts:', await page.locator('.com-post.org').count(), '| follow pills:', await page.locator('.com-follow').count());
  await page.screenshot({ path: OUT + '/1-student-community-all.png', fullPage: true });
  await page.goto(BASE + '/saved', { waitUntil: 'domcontentloaded' });
  await settle(page, 1500);
  console.log('saved posts:', await page.locator('.com-saved .com-post').count());
  await page.screenshot({ path: OUT + '/2-student-saved.png', fullPage: true });
  await page.goto(BASE + '/org/nyu-devs', { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  console.log('org page followers text:', await page.locator('.org-followers').textContent().catch(() => 'none'), '| on-the-board posts:', await page.locator('.org-post').count());
  await page.screenshot({ path: OUT + '/3-student-org-page.png', fullPage: true });
});

await session('hello@nyudevs.club', async (page) => {
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await settle(page, 2000);
  console.log('dash url', page.url(), '| numbers:', (await page.locator('.num-strip').textContent().catch(() => '')).replace(/\s+/g, ' '));
  await page.screenshot({ path: OUT + '/4-org-dashboard.png', fullPage: true });
  await page.goto(BASE + '/dashboard/community', { waitUntil: 'domcontentloaded' });
  await settle(page, 2500);
  console.log('org board url', page.url(), '| posts:', await page.locator('.com-post').count(), '| composer:', await page.locator('.com-input').getAttribute('placeholder'));
  await page.screenshot({ path: OUT + '/5-org-community.png', fullPage: true });
});

await browser.close();
console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
