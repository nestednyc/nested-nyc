// Walkthrough screenshots (JPEG, viewport-sized) of every Tier-1 + Tier-2
// surface on the seeded local stack. Output → e2e/shots/w-*.jpg
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { headlessLogin } from './_login.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174';
const OUT = process.env.OUT_DIR || new URL('./shots', import.meta.url).pathname;
const PASS = 'Passw0rd!';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const shot = (page, name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82, ...opts });
async function settle(page, ms = 1200) { try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {} await page.waitForTimeout(ms); }
function sql(q) {
  const c = execSync('docker ps -qf name=supabase_db_', { encoding: 'utf8' }).trim().split('\n')[0];
  return execSync(`docker exec -i ${c} psql -U postgres -d postgres -Atc "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}
async function open(email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await headlessLogin(page, BASE, email, PASS);
  return { ctx, page };
}

// ---- student: ada ----
{
  const { ctx, page } = await open('ada@nyu.edu');
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500);
  await shot(page, 'w01-board');
  await page.locator('.com-event').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot(page, 'w02-event');
  await page.locator('.com-post:has(.com-cta button:has-text("I\'m interested"))').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot(page, 'w03-ask');
  const win = page.locator('.com-post.kind-win:has(.com-imgs)').first();
  if (await win.count()) { await win.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot(page, 'w04-win'); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  // composer with "Looking for" selected
  await page.locator('.com-kind', { hasText: 'Looking for' }).click(); await page.waitForTimeout(200); await shot(page, 'w05-composer', { clip: { x: 0, y: 200, width: 1280, height: 420 } });
  await page.locator('.com-kind', { hasText: 'Update' }).click();
  // ⋯ menu on an org post (Copy link / Report)
  const orgMenu = page.locator('.com-post.org:not(.com-event) .com-menu-wrap .com-del').first();
  await orgMenu.scrollIntoViewIfNeeded(); await orgMenu.click(); await page.waitForTimeout(300); await shot(page, 'w06-menu-report');
  await page.keyboard.press('Escape');
  // bell panel
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
  await page.locator('.hdr-anchor .iconbtn').first().click(); await page.waitForTimeout(600); await shot(page, 'w07-bell');
  // a permalink of one of ada's posts, ⋯ menu open (Edit / Copy link / Delete)
  const adaPostId = sql(`select p.id from public.posts p join auth.users u on u.id = p.author_id where u.email='ada@nyu.edu' and p.org_id is null order by p.created_at desc limit 1`);
  await page.goto(BASE + '/community/' + adaPostId, { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
  await page.locator('.com-single .com-menu-wrap .com-del').click(); await page.waitForTimeout(300); await shot(page, 'w08-permalink-menu');
  await page.locator('.com-menu button', { hasText: 'Edit' }).click(); await page.waitForTimeout(300); await shot(page, 'w09-edit');
  await page.locator('.com-edit .btn-ghost').click();
  // notifications page
  await page.goto(BASE + '/notifications', { waitUntil: 'domcontentloaded' }); await settle(page, 1500); await shot(page, 'w10-notifications');
  // /saved: saved projects + saved community posts
  await page.goto(BASE + '/saved', { waitUntil: 'domcontentloaded' }); await settle(page, 2000); await shot(page, 'w11-saved');
  // quiet-board notes (age the seeded posts for the shot, then restore)
  sql(`update public.posts set created_at = created_at - interval '10 days'`);
  try {
    await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2000);
    await page.locator('.com-note').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await shot(page, 'w12-quiet-notes');
  } finally { sql(`update public.posts set created_at = created_at + interval '10 days'`); }
  // mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2000); await shot(page, 'w13-mobile');
  await ctx.close();
}
// ---- org owner: NYU Devs ----
{
  const { ctx, page } = await open('hello@nyudevs.club');
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page, 2000); await shot(page, 'w14-org-dashboard');
  await page.goto(BASE + '/dashboard/community', { waitUntil: 'domcontentloaded' }); await settle(page, 2500); await shot(page, 'w15-org-board');
  await page.goto(BASE + '/dashboard/edit', { waitUntil: 'domcontentloaded' }); await settle(page, 1500);
  const dots = page.locator('.onb-steps .dot'); if (await dots.count() >= 2) { await dots.nth(1).click(); await page.waitForTimeout(400); }
  await shot(page, 'w16-org-logo', { clip: { x: 0, y: 0, width: 1280, height: 700 } });
  await ctx.close();
}
// ---- digest sample ----
{
  const page = await browser.newPage({ viewport: { width: 700, height: 1100 } });
  await page.goto(new URL('./shots/digest-sample.html', import.meta.url).href, { waitUntil: 'load' }); await page.waitForTimeout(600);
  await shot(page, 'w17-digest', { fullPage: true });
  await page.close();
}
await browser.close();
console.log('shots done');
