import { chromium } from 'playwright';
import { headlessLogin } from './_login.mjs';
const BASE = 'http://127.0.0.1:5174';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
console.log('login', await headlessLogin(page, BASE, 'ada@nyu.edu', 'Passw0rd!'));
await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' });
try { await page.waitForSelector('.com-post', { timeout: 10000 }); } catch {}
await page.waitForTimeout(1200);
const rail = await page.locator('.com-rail-card h4').allTextContents();
console.log('posts', await page.locator('.com-post').count(), '| org posts', await page.locator('.com-post.org').count(), '| new chips', await page.locator('.com-new-chip').count(), '| rail:', rail.join(' / '));
console.log('students card rows', await page.locator('.com-rail-card:has(h4:text("Students on the board")) .com-rail-org').count());
await page.screenshot({ path: new URL('./shots/community-check.png', import.meta.url).pathname, fullPage: false });
console.log('errors:', errs.length ? errs.join('\n') : 'none');
await browser.close();
