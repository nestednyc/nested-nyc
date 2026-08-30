// Tier-2 checks on the seeded local stack + vite :5174: the post permalink,
// the notifications feed (like / comment / mention → bell → permalink), mark
// all read, post editing (· edited), the org dashboard's activity panel, and
// the quiet-board notes (seeded posts are aged 10 days for that one check).
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
async function open(email, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/409 \(Conflict\)/.test(m.text())) errors.push(`[${tag}] console: ${m.text().slice(0, 200)}`); });
  console.log('login', email, await headlessLogin(page, BASE, email, PASS));
  return { ctx, page };
}

// A fresh post by ada with a unique marker, so notifications are attributable.
const marker = 'T2-' + Date.now().toString(36);
// Posts are capped at 10/hr per author (PT429): clear earlier test-run posts by ada so stacked suites can't trip it.
sql(`delete from public.posts p using auth.users u where p.author_id=u.id and u.email='ada@nyu.edu' and p.created_at > now() - interval '1 hour' and (p.body like 'T2-%' or p.body like 'Tier-1 check%')`);
const ada = await open('ada@nyu.edu', 'ada');
{
  const { page } = ada;
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  await page.locator('.com-kind', { hasText: 'Win' }).click();
  await page.locator('.com-input').fill(`${marker} shipped the notifications feed`);
  await page.locator('.com-post-btn').click(); await settle(page, 1500);
  const first = page.locator('.com-post').first();
  check('ada posted a win', (await first.locator('.com-body').textContent()).includes(marker));
  // permalink via the timestamp
  await first.locator('.com-time').click(); await settle(page, 1500);
  check('timestamp opens the permalink', /\/community\/[0-9a-f-]{36}$/.test(page.url()), page.url());
  check('permalink renders the post with the thread open', (await page.locator('.com-single .com-post').count()) === 1 && (await page.locator('.com-comment-row').count()) === 1);
  // edit from the ⋯ menu
  await page.locator('.com-single .com-menu-wrap .com-del').click(); await page.waitForTimeout(250);
  await page.locator('.com-menu button', { hasText: 'Edit' }).click(); await page.waitForTimeout(250);
  check('edit mode opens', (await page.locator('.com-edit textarea').count()) === 1);
  await page.locator('.com-edit textarea').fill(`${marker} shipped the notifications feed (edited)`);
  await page.locator('.com-edit .btn-primary').click(); await settle(page, 1200);
  check('edited body saved + "· edited" stamp', (await page.locator('.com-single .com-body').textContent()).includes('(edited)') && (await page.locator('.com-single .com-post-head .com-meta').textContent()).includes('edited'));
  await page.screenshot({ path: OUT + '/t2-permalink-edited.png' });
}
const postId = ada.page.url().split('/').pop();

// maya likes, comments, and mentions ada; follows nyu-devs (org activity)
{
  const { page, ctx } = await open('maya.chen@newschool.edu', 'maya');
  await page.goto(BASE + '/community/' + postId, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('maya sees the permalink', (await page.locator('.com-single .com-post').count()) === 1);
  await page.locator('.com-single .com-act').first().click(); await settle(page, 800);           // like
  await page.locator('.com-comment-input').fill(`nice one — @nia_o you should see this — ${marker}`);
  await page.locator('.com-comment-row .com-act').click(); await settle(page, 1200);              // comment + mention
  check('comment landed', (await page.locator('.com-comment').count()) >= 1);
  // A fresh follow (the seed pre-follows nyu-devs for maya → drop it first so the click is an INSERT).
  sql(`delete from public.org_follows f using auth.users u, public.organizations o where f.user_id=u.id and f.org_id=o.id and u.email='maya.chen@newschool.edu' and o.slug='nyu-devs'`);
  await page.goto(BASE + '/org/nyu-devs', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  // Club pages put Join first (primary) and Follow second (ghost) until you follow — match by label, not class.
  const follow = page.locator('.org-cta button', { hasText: /^\s*Follow\s*$/ }).first();
  check('org page shows Follow (not Following) after the reset', /^\s*Follow\s*$/.test((await follow.textContent()) || ''));
  await follow.click(); await settle(page, 1200);
  await ctx.close();
}

// DB: the trigger rows exist
{
  const rows = sql(`select kind, count(*) from public.notifications where post_id = '${postId}' group by kind order by kind`);
  check('notifications rows written by triggers (like + comment + mention)', /post_like\|1/.test(rows) && /post_comment\|1/.test(rows) && /mention\|1/.test(rows), rows.replace(/\n/g, ' '));
  const mentionTo = sql(`select u.email from public.notifications n join auth.users u on u.id = n.user_id where n.kind='mention' and n.post_id='${postId}'`);
  check('the mention went to @nia_o (not the post author, who already gets post_comment)', mentionTo === 'nia.o@nyu.edu', mentionTo);
  const follow = sql(`select count(*) from public.notifications where kind='org_follow' and user_id = (select owner_user_id from public.organizations where slug='nyu-devs')`);
  check('org_follow notification for the org owner', Number(follow) >= 1, follow);
}

// ada's bell: realtime or reload — open the panel, see the rows, mark read via the page
{
  const { page } = ada;
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('bell dot lit', (await page.locator('.hdr-anchor .iconbtn .dot').count()) === 1);
  await page.locator('.hdr-anchor .iconbtn').first().click(); await page.waitForTimeout(600);
  const rows = await page.locator('.notif-row.act .nr-txt b').allTextContents();
  check('bell panel lists activity rows', rows.some((t) => /liked your post/.test(t)) && rows.some((t) => /commented on your post/.test(t)), rows.join(' | '));
  await page.screenshot({ path: OUT + '/t2-bell-panel.png' });
  await page.locator('.notif-row.act .nr-main').first().click(); await settle(page, 1500);
  check('activity row opens the permalink', page.url().endsWith('/community/' + postId), page.url());
  await page.goto(BASE + '/notifications', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  check('notifications page shows the Activity section', (await page.locator('.act-row').count()) >= 2, String(await page.locator('.act-row').count()));
  await page.waitForTimeout(800);
  const unread = sql(`select count(*) from public.notifications where user_id = (select id from auth.users where email='ada@nyu.edu') and read_at is null`);
  check('opening the page marked everything read (DB)', Number(unread) === 0, 'unread=' + unread);
  check('bell dot cleared', (await page.locator('.hdr-anchor .iconbtn .dot').count()) === 0);
  await page.screenshot({ path: OUT + '/t2-notifications-page.png', fullPage: true });
}

// quiet-board notes: age every seeded post 10 days → fewer than 10 this week → notes appear
{
  const { page } = ada;
  sql(`update public.posts set created_at = created_at - interval '10 days' where body not like '%${marker}%'`);
  try {
    await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
    const notes = await page.locator('.com-note').count();
    check('quiet board shows derived notes (new flyers / newcomers)', notes > 0, String(notes));
    await page.screenshot({ path: OUT + '/t2-quiet-notes.png', fullPage: false });
  } finally {
    sql(`update public.posts set created_at = created_at + interval '10 days' where body not like '%${marker}%'`);
  }
}
await ada.ctx.close();

// project owner → the board: tag control, "Post to the board" from the flyer, "On the board" on the flyer
{
  const { page, ctx } = await open('maya.chen@newschool.edu', 'maya-owner');
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  const opts = await page.locator('.com-project-select option').allTextContents();
  check('owner sees her project in the composer tag control', opts.some((t) => /Crit Circle/.test(t)), opts.join('|'));
  const projectId = sql(`select id from public.projects where name like 'Crit Circle%'`);
  await page.goto(BASE + '/projects/' + projectId, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  const postBtn = page.locator('.detail-cta button', { hasText: 'Post to the board' });
  check('flyer page offers "Post to the board" to the team', (await postBtn.count()) === 1);
  await postBtn.click(); await settle(page, 2000);
  check('lands on the board with the project pre-tagged', page.url().endsWith('/community') && (await page.locator('.com-project-select').inputValue()) === projectId, page.url());
  await page.locator('.com-kind', { hasText: 'Win' }).click();
  await page.locator('.com-input').fill(`Owner post ${marker}: week 4 of Crit Circle, 12 portfolios in`);
  await page.locator('.com-post-btn').click(); await settle(page, 1500);
  const firstCard = page.locator('.com-post').first();
  check('the note carries the project chip', /Crit Circle/.test(await firstCard.locator('.com-proj').textContent().catch(() => '')));
  await page.goto(BASE + '/projects/' + projectId, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  const onBoard = await page.locator('.detail-posts .detail-post').allTextContents();
  check('flyer page lists the note under "On the board"', onBoard.some((t) => t.includes(marker)), String(onBoard.length));
  await ctx.close();
}

// a student with no project still sees the tag control (pointing at pinning one)
{
  const { page, ctx } = await open('theo.b@cooper.edu', 'theo');
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('no-project student sees "Tag a project · pin one first"', (await page.locator('.com-tagchip').count()) === 1);
  await ctx.close();
}

// review regressions: a deep link to an org page shows the real Follow state
{
  const { page, ctx } = await open('ada@nyu.edu', 'ada-orgpage');
  await page.goto(BASE + '/org/nyu-devs', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  const label = ((await page.locator('.org-cta button', { hasText: /Follow/ }).first().textContent()) || '').trim();
  check('deep-linked /org/:slug reads Following for an org I follow (follows hydrate without the board)', /Following/.test(label), label);
  await ctx.close();
}

// org dashboard: recent activity panel + the org seat has no project navigation
{
  const { page, ctx } = await open('hello@nyudevs.club', 'org');
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  const acts = await page.locator('.act-row .act-txt b').allTextContents();
  check('org dashboard lists recent activity (follow)', acts.some((t) => /followed/.test(t)), acts.slice(0, 3).join(' | '));
  await page.screenshot({ path: OUT + '/t2-org-activity.png' });
  await page.goto(BASE + '/dashboard/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  check('org board: project tags are labels, not links', (await page.locator('button.com-proj').count()) === 0 && (await page.locator('.com-proj.static').count()) > 0);
  check('org board: no "I\'m interested" (join is a student action)', (await page.locator('.com-cta button', { hasText: "I'm interested" }).count()) === 0);
  check('org board: no Hot-on-the-board / flyer rows in the rail', !(await page.locator('.com-rail-card h4').allTextContents()).some((t) => /Hot on the board/.test(t)));
  await page.goto(BASE + '/org/columbia-build-lab', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  check('org viewing another org: no Follow / Join button', (await page.locator('.org-cta button').count()) === 0);
  await ctx.close();
}

await browser.close();
console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails || errors.length ? 1 : 0);
