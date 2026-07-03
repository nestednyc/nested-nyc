/* Post-refactor smoke: useToasts + useMessaging extraction (move-only).
   Server A :5173 — default env (configured mode): guest gating + toast path.
   Server B :5174 — env blanked (mock mode) + seeded LS profile: authed DM
   surfaces render through the hook; sign-out exercises resetMessaging. */
const { createRequire } = require('module');
const req = createRequire('/Users/hamza/Desktop/nested/package.json');
const { chromium } = req('playwright');

const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '   [' + String(extra).slice(0, 120) + ']' : ''));
};

(async () => {
  const browser = await chromium.launch();

  // ─── A: guest, configured mode ───
  {
    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.topbar', { timeout: 20000 });
    check('A1 guest: app shell renders', true);

    await page.click('.topbar .nav button:has-text("People")');
    let toastText = '';
    try {
      const t = await page.waitForSelector('.toast', { timeout: 6000 });
      toastText = (await t.textContent()) || '';
    } catch (e) {}
    check('A2 guest: People click fires requireAuth toast', /Sign in to meet other students/.test(toastText), toastText);
    try {
      await page.waitForFunction(() => location.pathname === '/signup', null, { timeout: 6000 });
      check('A3 guest: gated to /signup (auth wall)', true);
    } catch (e) { check('A3 guest: gated to /signup (auth wall)', false, await page.evaluate(() => location.pathname)); }

    await page.goto('http://localhost:5173/messages', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => location.pathname === '/signup', null, { timeout: 20000 });
      check('A4 guest: /messages deep link gates to /signup', true);
    } catch (e) { check('A4 guest: /messages deep link gates to /signup', false, await page.evaluate(() => location.pathname)); }

    check('A5 guest: no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
    if (consoleErrors.length) console.log('  (info) guest console.error:', consoleErrors.slice(0, 3).join(' | ').slice(0, 300));
    await page.close();
  }

  // ─── B: authed, mock mode ───
  {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('nested.nyc.v1', JSON.stringify({
        profile: { id: 'u-test', username: 'tester', name: 'Test Er', uni: 'nyu', photos: [] },
        joinedAt: 1750000000000,
      }));
    });

    await page.goto('http://localhost:5174/messages', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('.dm .dm-list', { timeout: 20000 });
      check('B1 mock-auth: /messages renders DM inbox shell', true);
    } catch (e) { check('B1 mock-auth: /messages renders DM inbox shell', false, e.message); }

    await page.goto('http://localhost:5174/messages/ghost', { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('.dm.show-thread', { timeout: 20000 });
      check('B2 mock-auth: /messages/:user renders thread pane', true);
    } catch (e) { check('B2 mock-auth: /messages/:user renders thread pane', false, e.message); }

    // Sign-out end-to-end: chip → panel → confirm → resetMessaging + toast + home.
    await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.topbar .me-chip', { timeout: 20000 });
    await page.click('.topbar .me-chip');
    await page.click('.hdr-anchor button:has-text("Sign out")');
    await page.waitForSelector('.modal .modal-actions .btn-primary', { timeout: 6000 });
    await page.click('.modal .modal-actions .btn-primary');
    let outToast = '';
    try {
      const t = await page.waitForSelector('.toast', { timeout: 6000 });
      outToast = (await t.textContent()) || '';
    } catch (e) {}
    check('B3 mock-auth: sign-out completes with toast', /Signed out/.test(outToast), outToast);
    const path = await page.evaluate(() => location.pathname);
    const guestCta = await page.$('.topbar button:has-text("Sign up")');
    check('B4 mock-auth: post-signout lands home as guest', path === '/' && !!guestCta, path);

    check('B5 mock-auth: no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await page.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `SMOKE FAILED (${failed.length})` : 'SMOKE OK (' + results.length + ' checks)');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(2); });
