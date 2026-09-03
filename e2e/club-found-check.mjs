// Student-founded clubs end-to-end against the local stack + a vite server:
// a student founds a club from Your corner → lands in club mode; the chip
// switcher, the account menu + mobile sheet entries, deep links and
// Back/Forward across the mode boundary, the public page's Manage button,
// posting as the club, "you're hosting" on the club's own event, a second
// club + switching, sign-out from club mode, the guest wall, and the
// org-email account's unchanged bare chip.
//   BASE_URL=http://127.0.0.1:5180 node e2e/club-found-check.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5180';
const OUT = process.env.OUT_DIR || fileURLToPath(new URL('./shots', import.meta.url)); // fileURLToPath: .pathname keeps a leading slash on Windows
const DB = process.env.DB_CONTAINER || 'supabase_db_nested-nyc';
const PASS = 'Passw0rd!';
// Any completed student with a campus works; the first that signs in wins.
const FOUNDERS = ['amy.eydman@nyu.edu', 'mockowner@nyu.edu', 'ui-desktop-0824@nyu.edu', 'ada@nyu.edu'];
const ORG_EMAIL = process.env.ORG_EMAIL || 'robotics.club0720@nyu.edu';
const STAMP = String(Date.now()).slice(-6);
const CLUB_A = 'E2E Club A ' + STAMP;
const CLUB_B = 'E2E Club B ' + STAMP;
await mkdir(OUT, { recursive: true });

const sql = (q) => execSync(`docker exec -i ${DB} psql -U postgres -d postgres -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
function cleanup() {
  sql(`delete from public.events where organization_id in (select id from public.organizations where slug like 'e2e-club-%')`);
  sql(`delete from public.organizations where slug like 'e2e-club-%'`);
}
cleanup();

// Wait for the dev server.
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(BASE + '/'); if (r.ok) break; } catch (e) {}
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const errors = [];
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); }
async function settle(page, ms = 1500) { await page.waitForTimeout(ms); }
async function fresh(viewport = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/54321|WebSocket|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
  return { ctx, page };
}
const n = (page, sel) => page.locator(sel).count();
const text = (page) => page.evaluate(() => document.body.innerText);
const path = (page) => new URL(page.url()).pathname;
const ls = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

// The founder may already run clubs (manual testing); the harness founds two
// more, so skip anyone within two of the 5-club cap.
async function loginFounder(page) {
  for (const email of FOUNDERS) {
    const owned = Number(sql(`select count(*) from public.organizations where owner_user_id = (select id from auth.users where email='${email}')`) || 0);
    if (owned > 3) { console.log('skip ' + email + ' — already owns ' + owned + ' orgs'); continue; }
    const r = await headlessLogin(page, BASE, email, PASS);
    if (r === 'OK') return email;
  }
  return null;
}
const START_RE = /Start (a|another) club/;

let founder = null;
let slugA = null, slugB = null, idA = null, idB = null;

// ── 1. Found a club from Your corner ──
{
  const { ctx, page } = await fresh();
  founder = await loginFounder(page);
  check('founder signs in', !!founder, founder || 'no candidate accepted Passw0rd!');
  if (!founder) { await ctx.close(); await browser.close(); process.exit(1); }
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('Your corner renders on the board', (await n(page, '.com-left')) === 1);
  // innerText reflects CSS text-transform (card headings are uppercase) — match case-insensitively.
  const startBtn = page.locator('.com-left button').filter({ hasText: START_RE });
  check('Your corner has the "Your clubs" card + a Start-a-club button', /your clubs/i.test(await text(page)) && (await startBtn.count()) === 1);
  await page.screenshot({ path: OUT + '/club-1-your-corner.png' });
  await startBtn.click(); await settle(page, 1200);
  check('Start a club → /clubs/new', path(page) === '/clubs/new', path(page));
  check('founding form: no org-type chips', !/What kind of org\?/.test(await text(page)));
  check('founding form: campus preselected from the profile', (await n(page, '.chips-grid .pick.on')) >= 1);
  check('founding form: "Back to the board" instead of sign-out', (await n(page, '.onb-aside button:has-text("Back to the board")')) === 1);
  await page.locator('input[placeholder="Tandon Robotics Club"]').fill(CLUB_A);
  await page.locator('button.btn-primary:has-text("Continue")').click(); await settle(page, 400);
  await page.locator('textarea.ta').fill('We build robots that lose gracefully at competitions.');
  await page.locator('input[placeholder="NYU Tandon, Brooklyn"]').fill('NYU Tandon, Brooklyn');
  await page.locator('button.btn-primary:has-text("Continue")').click(); await settle(page, 400);
  await page.locator('button.btn-primary:has-text("Continue")').click(); await settle(page, 400);
  check('founding form: step 4 copy is the student one', /Ready to open the doors\?/.test(await text(page)));
  await page.screenshot({ path: OUT + '/club-2-ready.png' });
  await page.locator('button.btn-primary:has-text("Start the club")').click(); await settle(page, 1200);
  check('toast: "<club> is live"', /is live/.test(await text(page)));
  await settle(page, 1800);
  check('after founding → /dashboard (club mode)', path(page) === '/dashboard', path(page));
  const row = sql(`select slug || '|' || type || '|' || student_run || '|' || verified || '|' || id from public.organizations where name='${CLUB_A}'`);
  [slugA, , , , idA] = row.split('|');
  check('DB row: type club, student_run true, verified false', /\|club\|true\|false\|/.test(row), row);
  check('dashboard: the club-mode chip', /Club mode/.test(await text(page)));
  check('dashboard: student-run echo, not "Pending review"', /live as a student-run club/i.test(await text(page)) && !/Pending review/i.test(await text(page)));
  await page.screenshot({ path: OUT + '/club-3-dashboard.png', fullPage: true });
  check('localStorage activeOrg = the new club', (await ls(page, 'nested.nyc.activeOrg.v1')) === idA);
  check('localStorage identity cache still holds the student', /"profile":\{/.test((await ls(page, 'nested.nyc.v1')) || ''));

  // Chip popover → back to student mode.
  await page.locator('.topbar .hdr-anchor .me-chip').click(); await settle(page, 400);
  check('chip opens the club panel', (await n(page, '.acct-menu button:has-text("Back to student mode")')) === 1);
  await page.screenshot({ path: OUT + '/club-4-club-panel.png' });
  await page.locator('.acct-menu button:has-text("Back to student mode")').click(); await settle(page, 1500);
  check('Back to student mode → /', path(page) === '/', path(page));
  check('student topbar is back (NAV + chip)', (await n(page, '.topbar .nav button')) >= 3 && (await n(page, '.topbar-desk .me-chip')) === 1);

  // Account menu lists the club.
  await page.locator('.topbar-desk .hdr-anchor .me-chip').click(); await settle(page, 400);
  check('account menu: "Manage <club>" row', (await n(page, `.acct-menu button:has-text("Manage ${CLUB_A}")`)) === 1);
  check('account menu: "Start another club" row', (await n(page, '.acct-menu button:has-text("Start another club")')) === 1);
  await page.screenshot({ path: OUT + '/club-5-account-menu.png' });
  await page.keyboard.press('Escape'); await settle(page, 300);

  // Deep links in both directions.
  await page.goto(BASE + '/dashboard/members', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('deep link /dashboard/members stays (club mode)', path(page) === '/dashboard/members' && /Applications/.test(await page.title()), path(page) + ' · ' + await page.title());
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('deep link /community stays (student mode)', path(page) === '/community' && (await n(page, '.com-left')) === 1, path(page));
  check('Your clubs lists the club', (await n(page, `.com-left .yc-org:has-text("${CLUB_A}")`)) === 1);

  // Back/Forward across the boundary (in-app navigation both ways).
  await page.locator(`.com-left .yc-org:has-text("${CLUB_A}")`).click(); await settle(page, 1500);
  check('Your corner "manage" → /dashboard', path(page) === '/dashboard' && /Club mode/.test(await text(page)), path(page));
  await page.goBack(); await settle(page, 1500);
  check('Back → /community in student mode', path(page) === '/community' && (await n(page, '.com-left')) === 1, path(page));
  await page.goForward(); await settle(page, 1500);
  check('Forward → /dashboard in club mode', path(page) === '/dashboard' && /Club mode/.test(await text(page)), path(page));
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('reload on /dashboard keeps club mode', path(page) === '/dashboard' && /Club mode/.test(await text(page)), path(page));

  // Public page of my own club → Manage, no Join/Follow.
  await page.goto(BASE + '/org/' + slugA, { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('/org/<my club>: "Manage club" replaces Join/Follow', (await n(page, '.org-cta button:has-text("Manage club")')) === 1 && (await n(page, '.org-cta button:has-text("Join")')) === 0 && (await n(page, '.org-cta button:has-text("Follow")')) === 0);
  check('/org/<my club>: student-run label + founder line', /student-run/i.test(await text(page)) && /founded by\s*@/i.test(await text(page))); // innerText breaks flex items onto lines
  await page.screenshot({ path: OUT + '/club-6-public-page.png', fullPage: true });

  // Post as the club from the org board.
  await page.goto(BASE + '/dashboard/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('/dashboard/community renders for a student-run club (no bounce)', path(page) === '/dashboard/community', path(page));
  await page.locator('.com-composer textarea').fill('First note from ' + CLUB_A);
  await page.locator('.com-post-btn').click(); await settle(page, 2500);
  const postRow = sql(`select count(*) from public.posts where org_id='${idA}'`);
  check('posted as the club (posts.org_id set)', postRow === '1', postRow);
  check('board card carries the student-run chip', (await n(page, '.com-post .com-student-chip')) >= 1);
  await page.screenshot({ path: OUT + '/club-7-org-board.png' });
  await ctx.close();
}

// ── 2. My own club's event, seen from student mode ──
{
  // psql -c prints the RETURNING row and then the "INSERT 0 1" tag — keep the first line only.
  const evId = sql(`insert into public.events (title, date, organizer_id, organization_id, event_type) values ('${CLUB_A} kickoff', (current_date + 7)::text, (select owner_user_id from public.organizations where id='${idA}'), '${idA}', 'talk') returning id`).split(/\r?\n/)[0].trim();
  const { ctx, page } = await fresh();
  await headlessLogin(page, BASE, founder, PASS);
  await page.goto(BASE + '/events/' + evId, { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('event page: "You\'re hosting" instead of RSVP', (await n(page, '.ev-rsvp-btn:has-text("hosting")')) === 1 && (await n(page, '.ev-rsvp-btn:has-text("going")')) === 0);
  check('event page renders in student mode (NAV present)', (await n(page, '.topbar .nav button')) >= 3);
  await page.screenshot({ path: OUT + '/club-8-hosting.png' });
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('board event card says "you\'re hosting" (no RSVP pill)', (await n(page, '.com-event:has-text("you\'re hosting")')) >= 1);
  await ctx.close();
}

// ── 3. Mobile sheet ──
{
  const { ctx, page } = await fresh({ width: 390, height: 844 });
  await headlessLogin(page, BASE, founder, PASS);
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  await page.locator('.mob-avatar').click(); await settle(page, 500);
  check('mobile sheet: "Manage <club>" row', (await n(page, `.acct-sheet .acct-item:has-text("Manage ${CLUB_A}")`)) === 1);
  check('mobile sheet: "Start another club" row', (await n(page, '.acct-sheet .acct-item:has-text("Start another club")')) === 1);
  await page.screenshot({ path: OUT + '/club-9-mobile-sheet.png' });
  await page.locator(`.acct-sheet .acct-item:has-text("Manage ${CLUB_A}")`).click(); await settle(page, 1500);
  check('mobile: manage → /dashboard', path(page) === '/dashboard', path(page));
  await ctx.close();
}

// ── 4. A second club + switching ──
{
  const { ctx, page } = await fresh();
  await headlessLogin(page, BASE, founder, PASS);
  await page.goto(BASE + '/clubs/new', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  await page.locator('input[placeholder="Tandon Robotics Club"]').fill(CLUB_B);
  await page.locator('button.btn-primary:has-text("Continue")').click(); await settle(page, 300);
  await page.locator('textarea.ta').fill('Second club.');
  await page.locator('input[placeholder="NYU Tandon, Brooklyn"]').fill('Brooklyn');
  await page.locator('button.btn-primary:has-text("Continue")').click(); await settle(page, 300);
  await page.locator('button.btn-primary:has-text("Continue")').click(); await settle(page, 300);
  await page.locator('button.btn-primary:has-text("Start the club")').click(); await settle(page, 3000);
  const rowB = sql(`select slug || '|' || id from public.organizations where name='${CLUB_B}'`);
  [slugB, idB] = rowB.split('|');
  check('second club founded → dashboard shows it', path(page) === '/dashboard' && (await n(page, `.topbar .me-chip:has-text("${CLUB_B}")`)) === 1);
  check('activeOrg = club B', (await ls(page, 'nested.nyc.activeOrg.v1')) === idB);
  await page.locator('.topbar .hdr-anchor .me-chip').click(); await settle(page, 400);
  check('club panel lists "Switch to <A>"', (await n(page, `.acct-menu button:has-text("Switch to ${CLUB_A}")`)) === 1);
  await page.locator(`.acct-menu button:has-text("Switch to ${CLUB_A}")`).click(); await settle(page, 2000);
  check('switch → dashboard shows club A', (await n(page, `.topbar .me-chip:has-text("${CLUB_A}")`)) === 1);
  check('activeOrg = club A', (await ls(page, 'nested.nyc.activeOrg.v1')) === idA);
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('reload keeps club A active', (await n(page, `.topbar .me-chip:has-text("${CLUB_A}")`)) === 1);
  await page.screenshot({ path: OUT + '/club-10-switched.png' });

  // Sign out from club mode.
  await page.locator('.topbar .hdr-anchor .me-chip').click(); await settle(page, 400);
  await page.locator('.acct-menu button:has-text("Sign out")').click(); await settle(page, 2500);
  check('sign out from club mode → guest home', path(page) === '/' && (await n(page, '.topbar button:has-text("Sign up")')) >= 1, path(page));
  // The identity cache's persist effect rewrites {profile:null} after sign-out (pre-existing); the
  // active-club key must be gone outright.
  check('sign out clears the active club + the cached profile', (await ls(page, 'nested.nyc.activeOrg.v1')) === null && !/"profile":\{/.test((await ls(page, 'nested.nyc.v1')) || ''));
  await ctx.close();
}

// ── 5. Guest hits /clubs/new → the auth wall ──
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '/clubs/new', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('guest /clubs/new → auth wall', path(page) === '/signup' && /Sign in to see that page/.test(await text(page)), path(page));
  await ctx.close();
}

// ── 6. Org-email account: unchanged bare chip ──
{
  const { ctx, page } = await fresh();
  const r = await headlessLogin(page, BASE, ORG_EMAIL, PASS);
  if (r !== 'OK') {
    console.log('SKIP org-email regression — could not sign in as ' + ORG_EMAIL + ' (' + r + ')');
  } else {
    await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
    check('org-email account: bare "Sign out →" chip, no popover anchor', (await n(page, '.topbar .me-chip:has-text("Sign out")')) === 1 && (await n(page, '.topbar .hdr-anchor')) === 0);
    await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
    check('org-email account: /community still bounces to the dashboard', path(page) === '/dashboard', path(page));
    await page.screenshot({ path: OUT + '/club-11-org-email.png' });
  }
  await ctx.close();
}

await browser.close();
cleanup();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed; ${errors.length} page/console errors`);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
process.exit(failed.length || errors.length ? 1 : 0);
