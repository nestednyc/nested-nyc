// Club membership end-to-end against the seeded local stack + vite :5174:
// the org sets join questions + a sign-up link, a student applies (required
// question enforced), the org accepts from /dashboard/members, the student
// becomes a member (roster, profile Clubs line, auto-follow); a second
// student is declined and can apply again; guests get the auth toast.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174';
const OUT = process.env.OUT_DIR || new URL('./shots', import.meta.url).pathname;
const PASS = 'Passw0rd!';
const ORG = { email: 'hello@nyudevs.club', slug: 'nyu-devs', name: 'NYU Devs' };
const S1 = { email: 'ada@nyu.edu', handle: 'ada_nyu' };
const S2 = { email: 'nia.o@nyu.edu', handle: 'nia_o' };
await mkdir(OUT, { recursive: true });

// Fresh slate for the org under test.
const sql = (q) => execSync(`docker exec -i supabase_db_nested-community psql -U postgres -d postgres -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
sql(`delete from org_memberships where org_id = (select id from organizations where slug='${ORG.slug}')`);
sql(`delete from org_follows where org_id = (select id from organizations where slug='${ORG.slug}') and user_id in (select id from profiles where username in ('${S1.handle}','${S2.handle}'))`);
sql(`delete from notifications where kind like 'org_join_%'`);
sql(`update organizations set join_questions='[]', join_url=null where slug='${ORG.slug}'`);

const browser = await chromium.launch();
const errors = [];
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); }
async function settle(page, ms = 1200) { await page.waitForTimeout(ms); }
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/54321|WebSocket|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
  return { ctx, page };
}
const n = (page, sel) => page.locator(sel).count();
const text = (page) => page.evaluate(() => document.body.innerText);

// ── 1. Org: set two questions (one required) + a sign-up link ──
{
  const { ctx, page } = await fresh();
  console.log('login org', await headlessLogin(page, BASE, ORG.email, PASS));
  await page.goto(BASE + '/dashboard/edit', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  // jump to step 3 (edit mode dots are buttons)
  await page.locator('.dot').nth(2).click(); await settle(page, 500);
  check('org edit: Membership step renders the question builder', (await n(page, '.qb')) === 1);
  await page.locator('.qb-add').click(); await settle(page, 200);
  await page.locator('.qb-prompt').nth(0).fill('Why do you want to join?');
  await page.locator('.qb-add').click(); await settle(page, 200);
  await page.locator('.qb-prompt').nth(1).fill('Which track?');
  const req = page.locator('.qb-row').nth(0).locator('input[type=checkbox]');
  if (await req.count()) { await req.check(); } else { await page.locator('.qb-row').nth(0).locator('button', { hasText: /required/i }).first().click().catch(() => {}); }
  await page.locator('.field input[placeholder^="https://"]').fill('https://forms.example.com/nyu-devs');
  await page.screenshot({ path: OUT + '/clubs-1-org-questions.png', fullPage: true });
  // next → save
  await page.locator('.dot').nth(3).click(); await settle(page, 400);
  await page.locator('button.btn-primary', { hasText: /save/i }).last().click(); await settle(page, 2000);
  const qn = sql(`select jsonb_array_length(join_questions) || '|' || coalesce(join_url,'') from organizations where slug='${ORG.slug}'`);
  check('org edit: questions + join_url saved', /^2\|https:\/\/forms\.example\.com/.test(qn), qn);
  await ctx.close();
}
const requiredIsSet = sql(`select (join_questions->0->>'required') from organizations where slug='${ORG.slug}'`) === 'true';
if (!requiredIsSet) sql(`update organizations set join_questions = jsonb_set(join_questions, '{0,required}', 'true') where slug='${ORG.slug}'`);

// ── 2. Guest: Join → auth toast ──
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '/org/' + ORG.slug, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  const joinBtn = page.locator('.org-cta button', { hasText: /^Join$/ });
  check('guest: Join button visible on the club page', (await joinBtn.count()) === 1);
  check('guest: sign-up link shown next to Join', (await n(page, '.org-cta a[href^="https://forms.example.com"]')) === 1);
  await joinBtn.click(); await settle(page, 600);
  check('guest: Join asks to sign in', /sign in/i.test(await text(page)));
  await ctx.close();
}

// ── 3. Student 1: apply (required question enforced) ──
{
  const { ctx, page } = await fresh();
  console.log('login s1', await headlessLogin(page, BASE, S1.email, PASS));
  await page.goto(BASE + '/org/' + ORG.slug, { waitUntil: 'domcontentloaded' }); await settle(page, 2200);
  await page.locator('.org-cta button', { hasText: /^Join$/ }).click(); await settle(page, 600);
  check('s1: application sheet opens', (await n(page, '.rsvp-modal')) === 1);
  check('s1: two questions asked', (await n(page, '.rsvp-q')) === 2);
  await page.locator('.rsvp-modal .btn-primary').click(); await settle(page, 400);
  check('s1: required question blocks submit', (await n(page, '.rsvp-q.bad')) === 1);
  await page.locator('.rsvp-q').nth(0).locator('input, textarea').first().fill('I build things on weekends.');
  await page.screenshot({ path: OUT + '/clubs-2-apply.png' });
  await page.locator('.rsvp-modal .btn-primary').click(); await settle(page, 1800);
  check('s1: sheet closes after submit', (await n(page, '.rsvp-modal')) === 0);
  check('s1: button reads Applied', (await n(page, '.org-cta button:has-text("Applied")')) === 1);
  const st = sql(`select status || '|' || (answers ? (select join_questions->0->>'id' from organizations where slug='${ORG.slug}'))::text from org_memberships m where m.user_id=(select id from profiles where username='${S1.handle}')`);
  check('s1: pending row with the answer stored', st === 'pending|true', st);
  check('s1: owner got an org_join_request notification', sql(`select count(*) from notifications where kind='org_join_request'`) === '1');
  // the board: org post shows Join pill state
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2200);
  check('s1: board org post shows Follow + Join pills', (await n(page, '.com-post.org .com-pills .com-join')) > 0);
  await ctx.close();
}

// ── 4. Student 2: apply, will be declined ──
{
  const { ctx, page } = await fresh();
  console.log('login s2', await headlessLogin(page, BASE, S2.email, PASS));
  await page.goto(BASE + '/org/' + ORG.slug, { waitUntil: 'domcontentloaded' }); await settle(page, 2200);
  await page.locator('.org-cta button', { hasText: /^Join$/ }).click(); await settle(page, 600);
  await page.locator('.rsvp-q').nth(0).locator('input, textarea').first().fill('Curious.');
  await page.locator('.rsvp-modal .btn-primary').click(); await settle(page, 1800);
  check('s2: applied', (await n(page, '.org-cta button:has-text("Applied")')) === 1);
  await ctx.close();
}

// ── 5. Org: review — accept s1, decline s2 ──
{
  const { ctx, page } = await fresh();
  console.log('login org', await headlessLogin(page, BASE, ORG.email, PASS));
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('dashboard: Applications row shows 2 pending', /2 pending/.test(await text(page)));
  await page.locator('.manage-row', { hasText: 'Applications' }).click(); await settle(page, 1800);
  check('members: route is /dashboard/members', page.url().endsWith('/dashboard/members'));
  check('members: two pending applicants', (await n(page, '.app-row')) === 2);
  check('members: answers shown', /I build things on weekends/.test(await text(page)));
  await page.screenshot({ path: OUT + '/clubs-3-applications.png', fullPage: true });
  const s1row = page.locator('.app-row', { hasText: '@' + S1.handle });
  await s1row.locator('button', { hasText: 'Accept' }).click(); await settle(page, 1500);
  const s2row = page.locator('.app-row', { hasText: '@' + S2.handle });
  await s2row.locator('button', { hasText: 'Decline' }).click(); await settle(page, 1500);
  check('members: pending tab now empty', (await n(page, '.app-row')) === 0);
  await page.locator('.dash-tabs .chip-filter', { hasText: 'Members' }).click(); await settle(page, 400);
  check('members: roster tab lists s1', (await n(page, '.app-row.accepted')) === 1);
  const db = sql(`select string_agg(p.username || ':' || m.status, ',' order by p.username) from org_memberships m join profiles p on p.id=m.user_id where m.org_id=(select id from organizations where slug='${ORG.slug}')`);
  check('db: statuses persisted', db === `${S1.handle}:accepted,${S2.handle}:rejected`, db);
  check('db: accepted student auto-follows', sql(`select count(*) from org_follows where org_id=(select id from organizations where slug='${ORG.slug}') and user_id=(select id from profiles where username='${S1.handle}')`) === '1');
  check('db: decision notifications to both students', sql(`select string_agg(kind, ',' order by kind) from notifications where kind in ('org_join_accepted','org_join_rejected')`) === 'org_join_accepted,org_join_rejected');
  await ctx.close();
}

// ── 6. Student 1 is a member; student 2 can apply again ──
{
  const { ctx, page } = await fresh();
  console.log('login s1', await headlessLogin(page, BASE, S1.email, PASS));
  await page.goto(BASE + '/org/' + ORG.slug, { waitUntil: 'domcontentloaded' }); await settle(page, 2400);
  check('s1: button reads Member', (await n(page, '.org-cta button:has-text("Member")')) === 1);
  check('s1: Following state on', (await n(page, '.org-cta button:has-text("Following")')) === 1);
  check('s1: roster lists them', (await n(page, '.roster-row')) === 1 && /@ada_nyu/.test(await page.locator('.roster').innerText()));
  check('s1: member count shown', /1\s*member/.test(await text(page)));
  await page.screenshot({ path: OUT + '/clubs-4-member.png', fullPage: true });
  await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('s1: profile shows the Clubs line', (await n(page, '.pf-clubs .pf-club')) === 1);
  await page.goto(BASE + '/u/' + S2.handle, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('s1: a non-member profile has no Clubs line', (await n(page, '.pf-clubs')) === 0);
  await page.goto(BASE + '/u/' + S1.handle, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('s1: /u/ page shows the Clubs line', (await n(page, '.pf-clubs .pf-club')) === 1);
  // mobile overflow with two pills on an org post
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2200);
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check('mobile: no horizontal overflow with Follow + Join', sw <= 390, 'scrollWidth=' + sw);
  await page.screenshot({ path: OUT + '/clubs-5-mobile.png' });
  await ctx.close();
}
{
  const { ctx, page } = await fresh();
  console.log('login s2', await headlessLogin(page, BASE, S2.email, PASS));
  await page.goto(BASE + '/org/' + ORG.slug, { waitUntil: 'domcontentloaded' }); await settle(page, 2400);
  check('s2: button reads Apply again', (await n(page, '.org-cta button:has-text("Apply again")')) === 1);
  await page.locator('.org-cta button', { hasText: 'Apply again' }).click(); await settle(page, 600);
  await page.locator('.rsvp-q').nth(0).locator('input, textarea').first().fill('Second try.');
  await page.locator('.rsvp-modal .btn-primary').click(); await settle(page, 1800);
  check('s2: re-apply re-opens the row as pending', sql(`select status from org_memberships where user_id=(select id from profiles where username='${S2.handle}')`) === 'pending');
  // withdraw
  await page.locator('.org-cta button', { hasText: 'Applied' }).click(); await settle(page, 400);
  check('s2: withdraw confirm opens', (await n(page, '.modal')) === 1);
  await page.locator('.modal .btn-primary, .modal .btn-danger').last().click(); await settle(page, 1500);
  check('s2: withdrawn — row gone', sql(`select count(*) from org_memberships where user_id=(select id from profiles where username='${S2.handle}')`) === '0');
  check('s2: button back to Join', (await n(page, '.org-cta button:has-text("Join")')) === 1);
  await ctx.close();
}

await browser.close();
console.log('\nERRORS: ' + (errors.length ? '\n' + errors.slice(0, 8).join('\n') : 'none'));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
