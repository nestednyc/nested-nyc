// e2e/authed-screenshots.mjs — logs in as a seeded .edu user and screenshots the
// AUTHENTICATED app in desktop + mobile. Requires the local Supabase stack up and
// the seed user to exist. Headless login imports the app's OWN supabase client
// singleton so the session lands on the exact storage key the app reads (no UI
// driving). See the dm-local-verification-harness note.
//
//   Run:  node e2e/authed-screenshots.mjs
//   Env:  BASE_URL, OUT_DIR, SEED_EMAIL, SEED_PASS

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'e2e', 'shots');
const EMAIL = process.env.SEED_EMAIL || 'alice.test@nyu.edu';
const PASS = process.env.SEED_PASS || 'Testpass1';

const ROUTES = [
  { path: '/',              name: 'discover' },
  { path: '/people',        name: 'people' },
  { path: '/messages',      name: 'messages' },
  { path: '/notifications', name: 'notifications' },
  { path: '/saved',         name: 'saved' },
  { path: '/profile',       name: 'profile' },
];
const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 900, isMobile: false, hasTouch: false, dsf: 1 },
  { tag: 'mobile',  width: 390,  height: 844, isMobile: true,  hasTouch: true,  dsf: 2 },
];

async function settle(page, ms = 900) {
  try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
  await page.waitForTimeout(ms);
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
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

    // Headless login via the app's own client singleton.
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const loginRes = await page.evaluate(async ({ email, pass }) => {
      const m = await import('/src/lib/supabase.js');
      const r = await m.authService.signInWithEmailPassword(email, pass);
      return r && r.error ? ('ERR: ' + (r.error.message || JSON.stringify(r.error))) : 'OK';
    }, { email: EMAIL, pass: PASS });
    console.log(`[${vp.tag}] login: ${loginRes}`);

    for (const r of ROUTES) {
      try {
        await page.goto(BASE + r.path, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const onboarding = await page.$('.onb-signup');
        await page.screenshot({ path: path.join(OUT, `auth-${vp.tag}-${r.name}.png`), fullPage: true });
        // Mobile discover: extra viewport shot so the top bar (new chat icon) is framed.
        if (vp.tag === 'mobile' && r.name === 'discover') {
          await page.screenshot({ path: path.join(OUT, `auth-mobile-topbar.png`), fullPage: false });
        }
        console.log(`   ${vp.tag} ${r.name}: ${onboarding ? 'NOT-AUTHED (onboarding shown)' : 'authed'}`);
      } catch (e) {
        console.log(`   ${vp.tag} ${r.name}: ERROR ${e.message.slice(0, 120)}`);
      }
    }
    report.push({ viewport: vp.tag, login: loginRes, errors });
    await ctx.close();
  }
  await browser.close();

  console.log('\n=== page errors ===');
  report.forEach((r) => {
    console.log(`${r.viewport} (login ${r.login}): ${r.errors.length}`);
    r.errors.slice(0, 8).forEach((e) => console.log('  - ' + e));
  });
  console.log('\nShots →', OUT);
}
run().catch((e) => { console.error(e); process.exit(1); });
