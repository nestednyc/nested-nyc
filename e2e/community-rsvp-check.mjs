// Event RSVP questions, end to end on the seeded local stack + vite :5174:
// the sheet from a board card (required validation → submit), "Your answers"
// + edit on the event page, the host's responses table + CSV, the builder on
// the edit form, and the un-RSVP cascade.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174';
const OUT = process.env.OUT_DIR || new URL('./shots', import.meta.url).pathname;
const PASS = 'Passw0rd!';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); }
async function settle(page, ms = 1200) { try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {} await page.waitForTimeout(ms); }
function sql(q) {
  const c = execSync('docker ps -qf name=supabase_db_', { encoding: 'utf8' }).trim().split('\n')[0];
  return execSync(`docker exec -i ${c} psql -U postgres -d postgres -Atc "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}
async function open(email, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/409 \(Conflict\)/.test(m.text())) errors.push(`[${tag}] console: ${m.text().slice(0, 200)}`); });
  console.log('login', email, await headlessLogin(page, BASE, email, PASS));
  return { ctx, page };
}
const eventId = sql(`select id from public.events where title = 'NYU Devs — open meetup'`);
// start clean: ada not going
sql(`delete from public.event_registrations r using auth.users u where r.user_id = u.id and u.email='ada@nyu.edu' and r.event_id='${eventId}'`);

// ---- student: the sheet from the board card ----
{
  const { ctx, page } = await open('ada@nyu.edu', 'ada');
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  const card = page.locator('.com-event', { hasText: 'NYU Devs — open meetup' }).first();
  await card.scrollIntoViewIfNeeded();
  check('board card says how many questions', /3 questions/.test(await card.locator('.com-ev-foot .com-meta').textContent()));
  await card.locator('.com-rsvp').click(); await page.waitForTimeout(500);
  check('"I\'m going" opens the answer sheet', (await page.locator('.rsvp-modal').count()) === 1);
  check('sheet lists the 3 questions', (await page.locator('.rsvp-modal .rsvp-q').count()) === 3);
  await page.locator('.rsvp-modal .modal-actions .btn-primary').click(); await page.waitForTimeout(400);
  check('required question blocks submit', (await page.locator('.rsvp-modal .rsvp-q.bad').count()) === 1 && (await page.locator('.rsvp-modal').count()) === 1);
  await page.screenshot({ path: OUT + '/rsvp-sheet.jpg', type: 'jpeg', quality: 80 });
  await page.locator('.rsvp-modal .pick', { hasText: 'AI / ML' }).click();
  await page.locator('.rsvp-modal .rsvp-q').nth(1).locator('input').fill('vegetarian');
  await page.locator('.rsvp-modal .rsvp-q').nth(2).locator('input[type=date]').fill('2005-03-14');
  await page.locator('.rsvp-modal .modal-actions .btn-primary').click(); await settle(page, 1500);
  check('sheet closes and the card flips to Going', (await page.locator('.rsvp-modal').count()) === 0 && /Going/.test(await card.locator('.com-rsvp').textContent()));
  const stored = sql(`select a.answers::text from public.event_rsvp_answers a join auth.users u on u.id=a.user_id where u.email='ada@nyu.edu' and a.event_id='${eventId}'`);
  check('answers stored via the RPC', /AI \/ ML/.test(stored) && /vegetarian/.test(stored) && /2005-03-14/.test(stored), stored.slice(0, 120));
  // the event page: your answers + edit
  await page.goto(BASE + '/events/' + eventId, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('event page shows "Your answers"', (await page.locator('.ev-answers .ev-answer').count()) === 3);
  await page.locator('.ev-answers .ghost-link', { hasText: 'Edit answers' }).click(); await page.waitForTimeout(400);
  check('edit reopens the sheet prefilled', (await page.locator('.rsvp-modal').count()) === 1 && (await page.locator('.rsvp-modal .rsvp-q').nth(1).locator('input').inputValue()) === 'vegetarian');
  await page.locator('.rsvp-modal .rsvp-q').nth(1).locator('input').fill('vegan');
  await page.locator('.rsvp-modal .modal-actions .btn-primary').click(); await settle(page, 1500);
  const updated = sql(`select a.answers->>'q_diet' from public.event_rsvp_answers a join auth.users u on u.id=a.user_id where u.email='ada@nyu.edu' and a.event_id='${eventId}'`);
  check('edited answer saved', updated === 'vegan', updated);
  await page.screenshot({ path: OUT + '/rsvp-your-answers.jpg', type: 'jpeg', quality: 80 });
  await ctx.close();
}

// ---- host: responses table + CSV + builder on edit ----
{
  const { ctx, page } = await open('hello@nyudevs.club', 'org');
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  await page.locator('.er-going-link').first().click(); await settle(page, 1500);
  check('dashboard RSVP count opens the responses screen', /\/dashboard\/events\/[0-9a-f-]+\/rsvps$/.test(page.url()), page.url());
  const rowText = await page.locator('.resp-table tbody tr', { hasText: '@ada_nyu' }).first().textContent().catch(() => '');
  check('responses table has Ada with her answers', /AI \/ ML/.test(rowText) && /vegan/.test(rowText) && /2005-03-14/.test(rowText), rowText.replace(/\s+/g, ' ').slice(0, 120));
  check('CSV download button present', (await page.locator('button', { hasText: 'Download CSV' }).count()) === 1);
  await page.screenshot({ path: OUT + '/rsvp-responses.jpg', type: 'jpeg', quality: 80 });
  // the builder on edit (step 3)
  await page.locator('button', { hasText: 'Edit event' }).click(); await settle(page, 1200);
  await page.locator('.onb-steps .dot').nth(2).click(); await page.waitForTimeout(400);
  check('edit form step 3 shows the 3 questions', (await page.locator('.qb-row').count()) === 3);
  await page.locator('.qb-add').click(); await page.waitForTimeout(200);
  await page.locator('.qb-row').nth(3).locator('.qb-prompt').fill('Bringing a +1?');
  await page.locator('.qb-row').nth(3).locator('.qb-type').selectOption('yesno');
  await page.screenshot({ path: OUT + '/rsvp-builder.jpg', type: 'jpeg', quality: 80 });
  await page.locator('.onb-actions .btn-primary').click(); await page.waitForTimeout(400);   // continue → step 4
  await page.locator('.onb-actions .btn-primary').click(); await settle(page, 1500);        // save
  const n = sql(`select jsonb_array_length(questions) from public.events where id='${eventId}'`);
  check('saved event now has 4 questions', n === '4', n);
  await ctx.close();
}

// ---- student: un-RSVP cascades the answers away ----
{
  const { ctx, page } = await open('ada@nyu.edu', 'ada2');
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  const card = page.locator('.com-event', { hasText: 'NYU Devs — open meetup' }).first();
  await card.scrollIntoViewIfNeeded();
  check('card shows Going after reload (count exact)', /Going/.test(await card.locator('.com-rsvp').textContent()));
  await card.locator('.com-rsvp').click(); await settle(page, 1200);
  const left = sql(`select count(*) from public.event_rsvp_answers a join auth.users u on u.id=a.user_id where u.email='ada@nyu.edu' and a.event_id='${eventId}'`);
  check('un-RSVP removes the answers (cascade)', left === '0', left);
  await ctx.close();
}
// restore the seeded 3 questions for the next run
sql(`update public.events set questions = questions - 3 where id='${eventId}' and jsonb_array_length(questions) = 4`);

await browser.close();
console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails || errors.length ? 1 : 0);
