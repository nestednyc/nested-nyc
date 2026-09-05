// The mode-switch curtain (the pixel-resolve between student and club mode) —
// mock-session harness, no local Supabase needed: @hamza owns Club A (see
// _mock-student-club.mjs). Checks that the canvas runs cover → reveal → gone
// around Manage / Back to student mode and the end state equals the plain
// navigation; that reduced motion and Back / Forward never animate; that a
// Back inside the cover wins; that a rapid double switch leaves nothing
// behind; and that 390 / 360 stay overflow-free through the reveal. Mid-
// animation stills (dev slow-mo ×4) land in e2e/shots/.
// Run: node e2e/mode-switch-check.mjs   [BASE_URL=http://localhost:5173]
import { chromium } from '/Users/hamza/Desktop/nested/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { BASE, wire } from './_mock-student-club.mjs';

const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (label, ok, detail) => { checks.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  [' + detail + ']' : ''}`); };
const pathOf = (page) => new URL(page.url()).pathname;
const body = (page) => page.evaluate(() => document.body.innerText);
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
const canvases = (page) => page.evaluate(() => document.querySelectorAll('.mode-curtain').length);
const histLen = (page) => page.evaluate(() => history.length);
const visit = async (page, path, settle = 1800) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(settle); };
const manage = async (page) => { await page.locator('.me-chip').click(); await page.waitForTimeout(300); await page.locator('.menu-item', { hasText: 'Manage Club A' }).click(); };
const backToBoard = async (page) => { await page.locator('.me-chip').click(); await page.waitForTimeout(300); await page.locator('.menu-item', { hasText: 'Back to student mode' }).click(); };

// Records every curtain attach / phase change / detach into window.__curtainLog.
const armLog = (page) => page.evaluate(() => {
  if (window.__curtainMO) window.__curtainMO.disconnect();
  window.__curtainLog = [];
  const log = window.__curtainLog;
  const note = (v) => { if (log[log.length - 1] !== v) log.push(v); };
  const isCurtain = (n) => n.nodeType === 1 && n.classList && n.classList.contains('mode-curtain');
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && isCurtain(m.target)) note(m.target.dataset.phase);
      for (const n of m.addedNodes) if (isCurtain(n)) note(n.dataset.phase);
      for (const n of m.removedNodes) if (isCurtain(n)) note('gone');
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-phase'] });
  window.__curtainMO = mo;
});
const readLog = (page) => page.evaluate(() => window.__curtainLog || []);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const FULL = ['cover', 'reveal', 'gone'];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/54321|WebSocket|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  };

  // ── Desktop ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    watch(page);
    await wire(page);
    await visit(page, '/community', 2200);
    check('board renders the student shell', (await body(page)).includes('@hamza'));

    // (a) Manage Club A → cover → reveal → gone, ends on /dashboard exactly like the plain navigation.
    const h0 = await histLen(page);
    await armLog(page);
    await manage(page);
    await page.waitForTimeout(80);
    const early = await page.evaluate(() => { const c = document.querySelector('.mode-curtain'); return { phase: c ? c.dataset.phase : 'none', pe: c ? getComputedStyle(c).pointerEvents : '', path: location.pathname }; });
    check('a: cover is up within 80ms, blocks input, URL not yet switched', early.phase === 'cover' && early.pe === 'auto' && early.path === '/community', JSON.stringify(early));
    await page.waitForTimeout(1200);
    let log = await readLog(page);
    let t = await body(page);
    check('a: phases cover → reveal → gone', same(log, FULL), log.join(','));
    check('a: → /dashboard in club mode', pathOf(page) === '/dashboard' && t.includes('Club mode') && t.includes('Your dashboard'), pathOf(page));
    check('a: no canvas left, one history entry pushed', (await canvases(page)) === 0 && (await histLen(page)) === h0 + 1, `hist ${h0}→${await histLen(page)}`);

    // (b) Back to student mode → same shape, ends on / (home) in the student shell.
    await armLog(page);
    await backToBoard(page);
    await page.waitForTimeout(1300);
    log = await readLog(page);
    t = await body(page);
    check('b: phases cover → reveal → gone', same(log, FULL), log.join(','));
    check('b: → / student shell', pathOf(page) === '/' && t.includes('@hamza'), pathOf(page));
    check('b: no canvas left', (await canvases(page)) === 0);

    // (d) History never animates.
    await armLog(page);
    await page.goBack(); await page.waitForTimeout(1200);
    check('d: Back → /dashboard without a curtain', pathOf(page) === '/dashboard' && (await body(page)).includes('Club mode') && same(await readLog(page), []), (await readLog(page)).join(','));
    await page.goForward(); await page.waitForTimeout(1200);
    check('d: Forward → / without a curtain', pathOf(page) === '/' && (await body(page)).includes('@hamza') && same(await readLog(page), []), (await readLog(page)).join(','));

    // (f) Rapid double: Back to student mode while the dashboard is still resolving.
    await visit(page, '/community', 2000);
    await armLog(page);
    await manage(page);
    await page.waitForSelector('.mode-curtain[data-phase="reveal"]', { timeout: 1500 });
    await backToBoard(page);   // the reveal canvas lets clicks through
    await page.waitForTimeout(1600);
    log = await readLog(page);
    check('f: double switch ends on / with nothing left behind', pathOf(page) === '/' && (await canvases(page)) === 0 && (await body(page)).includes('@hamza') && log[log.length - 1] === 'gone', pathOf(page) + ' ' + log.join(','));

    // (e) A Back inside the cover wins: the pending switch is dropped.
    await visit(page, '/', 2000);
    await page.locator('.topbar .nav button', { hasText: 'Community' }).first().click();
    await page.waitForTimeout(1200);
    check('e: in-app nav to /community (history seeded)', pathOf(page) === '/community', pathOf(page));
    await armLog(page);
    await page.locator('.me-chip').click(); await page.waitForTimeout(300);
    await page.locator('.menu-item', { hasText: 'Manage Club A' }).click({ noWaitAfter: true });
    await page.goBack();
    await page.waitForTimeout(900);
    log = await readLog(page);
    check('e: Back during the cover → home, no /dashboard push, curtain dropped', pathOf(page) === '/' && !log.includes('reveal') && (await canvases(page)) === 0, pathOf(page) + ' ' + log.join(','));
    await page.goForward(); await page.waitForTimeout(900);
    check('e: Forward lands on /community, not /dashboard', pathOf(page) === '/community', pathOf(page));

    // (h) Mid-animation stills at dev slow-mo ×4.
    await page.evaluate(() => localStorage.setItem('nested.dev.switchSlow', '4'));
    await visit(page, '/community', 2000);
    await page.locator('.me-chip').click(); await page.waitForTimeout(300);
    const t0 = Date.now();
    await page.locator('.menu-item', { hasText: 'Manage Club A' }).click();
    for (const at of [200, 520, 900, 1400]) {
      const wait = t0 + at - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      const phase = await page.evaluate(() => { const c = document.querySelector('.mode-curtain'); return c ? c.dataset.phase : 'none'; });
      await page.screenshot({ path: OUT + `switch-${String(at).padStart(4, '0')}-${phase}.png` });
    }
    await page.waitForTimeout(1200);
    check('h: slow-mo run still ends clean on /dashboard', pathOf(page) === '/dashboard' && (await canvases(page)) === 0, pathOf(page));
    await page.evaluate(() => localStorage.removeItem('nested.dev.switchSlow'));
    await page.close();
  }

  // (c) Reduced motion: no canvas, instant switch.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    watch(page);
    await wire(page);
    await visit(page, '/community', 2200);
    await armLog(page);
    await manage(page);
    await page.waitForTimeout(60);
    const now = pathOf(page);
    await page.waitForTimeout(900);
    check('c: reduced motion → /dashboard at once, never a curtain', now === '/dashboard' && same(await readLog(page), []) && (await canvases(page)) === 0, now + ' ' + (await readLog(page)).join(','));
    await page.close();
  }

  // (g) Mobile: sheet row → Manage; no horizontal overflow during or after the reveal.
  for (const w of [390, 360]) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    watch(page);
    await wire(page);
    await visit(page, '/community', 2200);
    await armLog(page);
    await page.locator('.mob-avatar').click(); await page.waitForTimeout(500);
    await page.locator('.acct-item', { hasText: 'Manage Club A' }).click();
    await page.waitForSelector('.mode-curtain[data-phase="reveal"]', { timeout: 1500 });
    let o = await overflow(page);
    check(`${w}: no horizontal overflow mid-reveal`, o.sw <= o.iw, `${o.sw} vs ${o.iw}`);
    await page.waitForTimeout(1200);
    o = await overflow(page);
    const log = await readLog(page);
    check(`${w}: sheet → /dashboard through the curtain`, pathOf(page) === '/dashboard' && same(log, FULL) && (await canvases(page)) === 0, pathOf(page) + ' ' + log.join(','));
    check(`${w}: no horizontal overflow after`, o.sw <= o.iw, `${o.sw} vs ${o.iw}`);
    await page.close();
  }

  console.log(checks.join('\n'));
  console.log('\n--- page errors (first 8) ---');
  console.log(errors.slice(0, 8).join('\n') || '(none)');
  await browser.close();
  const failed = checks.filter((c) => c.startsWith('FAIL')).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error('HARNESS CRASH:', e); process.exit(2); });
