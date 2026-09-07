// Nested AI intros, end to end on the seeded local stack + vite :5174:
// the runner sends an intro ada → bob, bob's inbox row looks normal, bob's
// thread opens on the card + the flame-marked bubble, bob's first reply makes
// the card go away, and ada's side shows a plain thread. Screenshots land in
// e2e/shots/intro-*.png; any page error fails the run.
//   supabase start → supabase db reset → node scripts/seed-local.mjs
//   → VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<local anon> npm run dev -- --port 5174
//   → node e2e/intro-check.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
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
function sql(q) {
  const c = execSync('docker ps -qf name=supabase_db_', { encoding: 'utf8' }).trim().split('\n')[0];
  return execSync(`docker exec -i ${c} psql -U postgres -d postgres -Atc "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}
async function open(email, tag, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/409 \(Conflict\)/.test(m.text())) errors.push(`[${tag}] console: ${m.text().slice(0, 200)}`); });
  console.log('login', email, await headlessLogin(page, BASE, email, PASS));
  return { ctx, page };
}

// ---- fixtures: ada (the sender) and bob (the receiver), both finished students with photos, seen today
sql(`update public.profiles p set onboarding_completed = true, username = 'bob_nyu', first_name = 'Bob', last_name = 'Builder',
  university = 'nyu', photos = array['${BASE}/favicon-96.png'], skills = array['Backend','Data'], fields = array['Fintech']
  from auth.users u where u.id = p.id and u.email = 'bob@nyu.edu'`);
sql(`update public.profiles p set photos = array['${BASE}/apple-touch-icon.png'], skills = array['Backend','Strategy'], fields = array['Fintech','Social impact']
  from auth.users u where u.id = p.id and u.email = 'ada@nyu.edu'`);
sql(`update auth.users set last_sign_in_at = now() where email in ('ada@nyu.edu','bob@nyu.edu')`);
const ids = Object.fromEntries(sql(`select email, id from auth.users where email in ('ada@nyu.edu','bob@nyu.edu')`).split('\n').map((l) => l.split('|')));
const ADA = ids['ada@nyu.edu'], BOB = ids['bob@nyu.edu'];
// clean slate between runs
sql(`delete from public.intro_log where (sender_id='${ADA}' and recipient_id='${BOB}') or (sender_id='${BOB}' and recipient_id='${ADA}')`);
sql(`delete from public.messages where (sender_id='${ADA}' and recipient_id='${BOB}') or (sender_id='${BOB}' and recipient_id='${ADA}')`);
sql(`delete from public.message_notify_log where sender_id in ('${ADA}','${BOB}')`);
sql(`delete from public.connections where (user_id='${ADA}' and target_id='${BOB}') or (user_id='${BOB}' and target_id='${ADA}')`);
sql(`delete from public.conversation_clears where user_id in ('${ADA}','${BOB}')`);

// ---- the runner sends one intro
const roundFile = OUT + '/intro-round.json';
const BODY = 'hey Bob, we both put down backend, and fintech. I’m business at NYU but I code on the backend side too. what are you working on right now?';
await writeFile(roundFile, JSON.stringify([{ sender: 'ada_nyu', recipient: 'bob_nyu', body: BODY, note: 'You and Ada both do backend.', batch: 'e2e' }]));
const dry = execSync(`node scripts/send-intros.mjs --local --file ${roundFile}`, { encoding: 'utf8' });
check('runner dry run says it would send', /ok — would send/.test(dry) && /would send 1, skipped 0/.test(dry), dry.split('\n').slice(-2).join(' '));
const live = execSync(`node scripts/send-intros.mjs --local --send --file ${roundFile}`, { encoding: 'utf8' });
check('runner sent the intro', /SENT — message [0-9a-f-]{36}/.test(live), live.split('\n').filter((l) => /SENT|skipped/.test(l)).join(' '));
check('runner refuses to send the same pair twice', /already introduced/.test(execSync(`node scripts/send-intros.mjs --local --file ${roundFile}`, { encoding: 'utf8' })));
check('DB: one intro row with origin=intro and the note', sql(`select count(*) from public.messages where sender_id='${ADA}' and recipient_id='${BOB}' and origin='intro' and intro_note='You and Ada both do backend.'`) === '1');
check('DB: one intro_log row', sql(`select count(*) from public.intro_log where sender_id='${ADA}' and recipient_id='${BOB}'`) === '1');

// ---- bob: the outside, then the inside
const bob = await open('bob@nyu.edu', 'bob');
{
  const { page } = bob;
  await page.goto(BASE + '/messages', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('bob: one inbox row', (await page.locator('.msg-row').count()) === 1);
  const preview = await page.locator('.msg-row .msg-preview').first().textContent();
  check('bob: the row previews the message like any other (no You: prefix, no mark)', preview.startsWith('hey Bob') && (await page.locator('.intro-card, .flame').count()) === 0, preview.slice(0, 40));
  check('bob: the row is unread', (await page.locator('.msg-row.unread').count()) === 1);
  await page.screenshot({ path: OUT + '/intro-1-bob-inbox.png' });

  await page.goto(BASE + '/messages/ada_nyu', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('bob: the intro card is at the top of the thread', (await page.locator('.intro-card').count()) === 1);
  check('bob: the card names Nested AI and carries the note', /Nested AI/.test(await page.locator('.intro-title').textContent()) && (await page.locator('.intro-note').textContent()) === 'You and Ada both do backend.');
  check('bob: two faces on the card', (await page.locator('.intro-faces .av').count()) === 2);
  check('bob: the bubble wears the flame', (await page.locator('.bubble.them.intro .flame').count()) === 1);
  check('bob: three sparks + the AI mark', (await page.locator('.flame .sp').count()) === 3 && (await page.locator('.flame .ai').count()) === 1);
  check('bob: the body is the message, nothing about Nested', (await page.locator('.bubble-body').textContent()) === BODY);
  await page.screenshot({ path: OUT + '/intro-2-bob-thread.png' });

  // his first reply → the card goes away
  await page.locator('.composer-input').fill('yes!! what are you building?');
  await page.locator('.composer-send').click(); await settle(page, 2000);
  check('bob: after replying the card is gone', (await page.locator('.intro-card').count()) === 0);
  check('bob: his reply sits on the right, the intro keeps its flame', (await page.locator('.bubble.me').count()) === 1 && (await page.locator('.bubble.them.intro .flame').count()) === 1);
  await page.screenshot({ path: OUT + '/intro-3-bob-replied.png' });
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('bob: still no card after a reload', (await page.locator('.intro-card').count()) === 0 && (await page.locator('.bubble').count()) === 2);
  check('DB: the reply is a normal row', sql(`select count(*) from public.messages where sender_id='${BOB}' and recipient_id='${ADA}' and origin is null`) === '1');
}
// phone width, fresh context: the card + flame at 390
{
  const m = await open('bob@nyu.edu', 'bob-390', { width: 390, height: 844 });
  sql(`delete from public.messages where sender_id='${BOB}' and recipient_id='${ADA}'`);   // un-reply so the card shows again
  await m.page.goto(BASE + '/messages/ada_nyu', { waitUntil: 'domcontentloaded' }); await settle(m.page, 2000);
  check('390: card + flame render', (await m.page.locator('.intro-card').count()) === 1 && (await m.page.locator('.flame').count()) === 1);
  const o = await m.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check('390: no horizontal overflow', o.sw <= o.iw, `${o.sw} vs ${o.iw}`);
  await m.page.screenshot({ path: OUT + '/intro-4-bob-390.png' });
  await m.ctx.close();
}
// ---- ada: the sender's side is plain
const ada = await open('ada@nyu.edu', 'ada');
{
  const { page } = ada;
  await page.goto(BASE + '/messages', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  const preview = await page.locator('.msg-row .msg-preview').first().textContent();
  check('ada: her inbox row reads "You: …", nothing marks it', preview.startsWith('You: hey Bob') && (await page.locator('.intro-card, .flame').count()) === 0, preview.slice(0, 40));
  await page.goto(BASE + '/messages/bob_nyu', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('ada: no card, no flame on her side', (await page.locator('.intro-card').count()) === 0 && (await page.locator('.flame').count()) === 0);
  check('ada: the intro is her own plain bubble', (await page.locator('.bubble.me').count()) === 1 && (await page.locator('.bubble.me .bubble-body').textContent()) === BODY);
  await page.screenshot({ path: OUT + '/intro-5-ada-thread.png' });
}

await browser.close();
if (errors.length) { console.log('ERRORS:'); for (const e of errors.slice(0, 8)) console.log('  ' + e); }
const fails = results.filter((r) => !r.ok).length;
console.log(`${results.length - fails}/${results.length} checks passed`);
process.exit(fails || errors.length ? 1 : 0);
