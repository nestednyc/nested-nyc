/* ============================================================
   E2E: org sign-in routing (H1) + campus-branding (H2) against a
   LOCAL Supabase stack. Real logins through the app's own client.

   Prereqs (see plan): supabase running, `node scripts/seed-local.mjs`,
   and `npm run dev` serving :5173 against .env.local (local backend).
   Run: node e2e/org-auth-flows.mjs   [BASE_URL=http://localhost:5173]

   Personas (password Passw0rd!): owner@nyu.edu (org owner),
   ada@nyu.edu (completed student), bob@nyu.edu (incomplete student).
   ============================================================ */
import { chromium } from 'playwright';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const PASS = 'Passw0rd!';

const results = [];
const pageErrors = [];
function check(name, ok, extra) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}
function watch(page, tag) {
  page.on('pageerror', (e) => pageErrors.push(`[${tag}] ${e.message}`));
}
const atPath = (p) => (u) => new URL(u).pathname === p;

// Sign in through the STUDENT "Log in" door (the 2-step wizard).
async function studentDoorLogin(page, email) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('input[type=password]');
  await page.fill('input[type=password]', PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

// Arrive already-authed via the app's own client (for screens past login).
// The shared helper (e2e/_login.mjs) returns 'OK' | 'ERR: …'; throw here.
async function apiLogin(page, email) {
  const r = await headlessLogin(page, BASE, email, PASS);
  if (r !== 'OK') throw new Error('apiLogin ' + email + ' → ' + r);
}

async function run(name, browser, fn) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  watch(page, name);
  try { await fn(page, ctx); }
  catch (e) { check(name, false, e.message); }
  finally { await ctx.close(); }
}

const browser = await chromium.launch();

// H1a — org owner is BLOCKED at the STUDENT door (orgs have their own sign-in):
// toast + sign-out → onSignedOut lands them on Discover as a guest, NOT /dashboard.
await run('H1a org owner blocked at student door → guest Discover', browser, async (page) => {
  await studentDoorLogin(page, 'owner@nyu.edu');
  await page.waitForURL(atPath('/'), { timeout: 15000 });
  await page.getByRole('button', { name: 'Log in' }).first().waitFor({ timeout: 8000 }); // signed back out
  const guest = await page.getByRole('button', { name: 'Log in' }).count();
  check('H1a org owner blocked at student door → guest Discover',
    guest > 0 && !page.url().includes('/dashboard'), `guestLogin=${guest} url=${page.url()}`);
});

// H1b — completed student → discover, authed (regression)
await run('H1b completed student → discover (authed)', browser, async (page) => {
  await studentDoorLogin(page, 'ada@nyu.edu');
  await page.waitForURL(atPath('/'), { timeout: 15000 });
  const guestLoginBtns = await page.getByRole('button', { name: 'Log in' }).count();
  await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded' });
  let handle = 0;
  try { await page.getByText('ada_nyu', { exact: false }).first().waitFor({ timeout: 8000 }); handle = 1; } catch {}
  check('H1b completed student → discover (authed)', guestLoginBtns === 0 && handle > 0,
    `guestLoginBtns=${guestLoginBtns} handle=${handle}`);
});

// H1c — incomplete student takes the normal student path → Discover (authed),
// and is NOT frozen on a disabled sign-in form. waitForURL('/') TIMES OUT on the
// old freeze (which stuck at /signup), so this check now goes red on a regression.
await run('H1c incomplete student → Discover, not frozen', browser, async (page) => {
  await studentDoorLogin(page, 'bob@nyu.edu');
  await page.waitForURL(atPath('/'), { timeout: 15000 });
  const pwFields = await page.locator('input[type=password]').count();               // sign-in form gone
  const stuckSpinner = await page.getByText('Just a sec…', { exact: false }).count(); // not frozen
  const guestBtns = await page.getByRole('button', { name: 'Log in' }).count();       // AUTHED, not signed out
  check('H1c incomplete student → Discover, not frozen',
    pwFields === 0 && stuckSpinner === 0 && guestBtns === 0,
    `pw=${pwFields} spinner=${stuckSpinner} guest=${guestBtns} url=${page.url()}`);
});

// Org-door regression — owner via /org/signup → dashboard
await run('Org-door sign-in → /dashboard', browser, async (page) => {
  await page.goto(BASE + '/org/signup', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Already have an org account/i }).click();
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', 'owner@nyu.edu');
  await page.fill('input[type=password]', PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(atPath('/dashboard'), { timeout: 15000 });
  check('Org-door sign-in → /dashboard', true, page.url());
});

// Signup-door block — org creds through the STUDENT SIGNUP wizard must be
// rejected before any student fields are upserted onto the org's profile row.
// Locally: the step-0 email pre-check fails open (no /api/check-email under
// vite dev) and autoconfirm makes signUp return "already registered", so the
// wizard reaches finishSignup's sign-in fallback → blockOrgAccount fires.
await run('Signup-door: org creds blocked before upsert', browser, async (page) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Sign up/ }).first().click();
  await page.waitForSelector('input[type=email]');
  await page.fill('input[type=email]', 'owner@nyu.edu');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('input[type=password]');                 // step 1: password + confirm
  const pw = page.locator('input[type=password]');
  await pw.nth(0).fill(PASS);
  await pw.nth(1).fill(PASS);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('.input-wrap .at');                      // step 2: username
  await page.locator('.input-wrap input').fill('orgblk' + String(Date.now()).slice(-8));
  await page.getByText('is available', { exact: false }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('.uni-list');                            // step 3: campus (NYU pre-selected from email) + major
  await page.locator('.chips-grid .pick').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Step 5', { exact: false }).waitFor({ timeout: 8000 }); // step 4 kicker (majors grid is gone)
  for (let i = 0; i < 3; i++) await page.locator('.chips-grid .pick').nth(i).click(); // interests — pick 3
  await page.getByRole('button', { name: 'Enter Nested' }).click();
  await page.getByText('organization account', { exact: false }).waitFor({ timeout: 15000 }); // the block toast
  await page.waitForURL(atPath('/'), { timeout: 15000 });
  await page.getByRole('button', { name: 'Log in' }).first().waitFor({ timeout: 8000 });      // signed out → guest
  check('Signup-door: org creds blocked before upsert', true, page.url());
});

// H2a + H2b — edit prefill, data integrity, dashboard flyer branding
await run('H2a/H2b org edit prefill + flyer branding', browser, async (page) => {
  await apiLogin(page, 'owner@nyu.edu');
  await page.goto(BASE + '/dashboard/edit', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.chips-grid .pick.on', { timeout: 12000 });
  const selected = await page.$$eval('.pick.on', (els) => els.map((e) => e.textContent.trim()));
  check('H2a campus prefilled (a selected chip = NYU)', selected.some((t) => /NYU/i.test(t)), JSON.stringify(selected));

  // Edit only the bio, then save.
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('textarea.ta');
  await page.fill('textarea.ta', 'Edited by the E2E run.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(atPath('/dashboard'), { timeout: 15000 });

  // H2b — the "Your public flyer" OrgMini keeps the campus mark, no reload.
  await page.waitForSelector('.org-mini', { timeout: 8000 });
  const uniLogo = await page.locator('.org-mini .uni-logo').count();
  const sub = (await page.locator('.org-mini .org-mini-id small').first().textContent().catch(() => '')) || '';
  check('H2b flyer keeps campus mark after save (no reload)', uniLogo > 0 && /NYU/i.test(sub), `uniLogo=${uniLogo} sub="${sub}"`);

  // H2a data integrity — reopen edit, campus still selected (university_id survived).
  await page.goto(BASE + '/dashboard/edit', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.chips-grid .pick.on', { timeout: 12000 });
  const selected2 = await page.$$eval('.pick.on', (els) => els.map((e) => e.textContent.trim()));
  check('H2a university_id preserved after save', selected2.some((t) => /NYU/i.test(t)), JSON.stringify(selected2));
});

// H2b — public org page branding, viewed as a GUEST (owner's own slug upgrades to dashboard)
await run('H2b public org page branding (guest)', browser, async (page) => {
  await page.goto(BASE + '/org/nyu-devs', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.org-page', { timeout: 12000 });
  const uniLogo = await page.locator('.org-headline .uni-logo').count();
  check('H2b public org page branding (guest)', uniLogo > 0, `uniLogo=${uniLogo}`);
});

// orgOnboard create-flow smoke — the onCreated enrichment path shouldn't throw
await run('orgOnboard create → dashboard (pending)', browser, async (page) => {
  await page.goto(BASE + '/org/signup', { waitUntil: 'domcontentloaded' });
  const uniq = Date.now();
  const email = 'org.e2e.' + uniq + '@example.com';
  await page.fill('input[type=email]', email);
  const pw = page.locator('input[type=password]');
  await pw.nth(0).fill(PASS);
  await pw.nth(1).fill(PASS);
  await page.getByRole('button', { name: 'Create org account' }).click();
  await page.waitForURL(atPath('/org/onboarding'), { timeout: 15000 });
  await page.fill('input[placeholder="NYU AI Collective"]', 'E2E Club ' + uniq); // unique name → unique slug, re-runnable
  await page.locator('.chips-grid .pick', { hasText: 'Student club' }).click();
  await page.locator('.chips-grid .pick', { hasText: 'NYU' }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('textarea.ta');
  await page.fill('textarea.ta', 'We build things at NYU.');
  await page.fill('input[placeholder="NYU Tandon, Brooklyn"]', 'NYU, NYC');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Pin your org' }).click();
  await page.waitForURL(atPath('/dashboard'), { timeout: 15000 });
  const pending = await page.getByText('Pending review', { exact: false }).count();
  check('orgOnboard create → dashboard (pending)', pending > 0, `pendingText=${pending}`);
  // Prove the create-path enrichment set the campus (not the load race): reopen
  // the new org's edit — the NYU chip must be pre-selected (university_id persisted).
  await page.goto(BASE + '/dashboard/edit', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.chips-grid .pick.on', { timeout: 12000 });
  const created = await page.$$eval('.pick.on', (els) => els.map((e) => e.textContent.trim()));
  check('orgOnboard create set campus (NYU) — university_id persisted',
    created.some((t) => /NYU/i.test(t)), JSON.stringify(created));
});

await browser.close();

const failed = results.filter((r) => !r.ok);
if (pageErrors.length) {
  console.log('\nPage errors:');
  pageErrors.forEach((e) => console.log('  ' + e));
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed` +
  (pageErrors.length ? `, ${pageErrors.length} page error(s)` : ''));
process.exit(failed.length || pageErrors.length ? 1 : 0);
