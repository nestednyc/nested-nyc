// Focused check: is the mobile enrichment step-2 primary CTA sticky, and does it
// occlude the bottom "Reach me" links, or is the full-page overlap just an artifact?
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(process.cwd(), 'e2e', 'shots');

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`${BASE}/signup?preview=enrich`, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('.onb-actions-enrich');
await p.click('.onb-actions-enrich .btn.btn-primary'); await p.waitForTimeout(300); // step 1
await p.click('.onb-actions-enrich .btn.btn-primary'); await p.waitForTimeout(400); // step 2

// Diagnostic: computed position of the actions bar + primary button
const diag = await p.evaluate(() => {
  const bar = document.querySelector('.onb-actions-enrich');
  const btn = document.querySelector('.onb-actions-enrich .btn.btn-primary');
  const cs = (el) => el ? getComputedStyle(el) : null;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
  return {
    barPosition: cs(bar)?.position,
    btnPosition: cs(btn)?.position,
    barRect: bar ? rect(bar) : null,
    innerH: window.innerHeight,
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
  };
});
console.log('DIAG', JSON.stringify(diag));

// Scroll the last "Reach me" input (insta) into view and see if it clears the CTA
await p.evaluate(() => { const inp = [...document.querySelectorAll('.onb-card input')].pop(); inp && inp.scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(OUT, 'mobile-step2-lastlink.png'), fullPage: false });

// Hard scroll to the very bottom
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(OUT, 'mobile-step2-bottom.png'), fullPage: false });

// Report whether the last input is covered by the CTA bar
const overlap = await p.evaluate(() => {
  const inp = [...document.querySelectorAll('.onb-card input')].pop();
  const btn = document.querySelector('.onb-actions-enrich .btn.btn-primary');
  if (!inp || !btn) return 'missing';
  const a = inp.getBoundingClientRect(), c = btn.getBoundingClientRect();
  const covered = !(a.bottom <= c.top || a.top >= c.bottom);
  return { lastInputTop: Math.round(a.top), lastInputBottom: Math.round(a.bottom), ctaTop: Math.round(c.top), ctaBottom: Math.round(c.bottom), covered };
});
console.log('OVERLAP', JSON.stringify(overlap));

await b.close();
console.log('done');
