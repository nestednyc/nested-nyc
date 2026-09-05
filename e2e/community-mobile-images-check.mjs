// Mock-session harness (no local Supabase needed): the community board with
// canned posts covering every image count — lone tall / wide / square (the
// "renders whole, never cropped" fix), 2/3/4 grids — plus a comment thread
// with one-level replies. Verified at true mobile widths (360 / 390) and
// desktop 1280: no horizontal overflow, lone images contain-fit under the
// mobile cap, grids keep their shape, replies indent without overflowing.
// Shots land in e2e/shots/. Run: node e2e/community-mobile-images-check.mjs
import { chromium } from '/Users/hamza/Desktop/nested/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

// Inline SVGs with real intrinsic sizes — aspect behavior is the test.
const svg = (w, h, color, label) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="100%" height="100%" fill="${color}"/>` +
  `<rect x="${w * 0.06}" y="${h * 0.06}" width="${w * 0.88}" height="${h * 0.88}" fill="none" stroke="#ffffff55" stroke-width="${Math.max(w, h) * 0.01}"/>` +
  `<text x="50%" y="52%" font-size="${Math.min(w, h) / 7}" text-anchor="middle" fill="#fff" font-family="monospace">${label}</text></svg>`);

const ME = { id: 'u-me', username: 'hamza', first_name: 'Hamza', last_name: 'Harb', university: 'nyu', account_type: 'student', onboarding_completed: true, avatar: null, photos: [], skills: [], fields: [], links: {}, major: 'CS', year: "'27", bio: '', building: '', created_at: '2026-06-01T00:00:00Z' };
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const post = (id, kind, author, handle, uni, body, images, at, extra = {}) => ({
  id, kind, author_id: extra.mine ? 'u-me' : 'p-' + handle, author_name: author, author_handle: handle,
  author_avatar: '', is_first: false, body, images, university: uni, project_id: null, org_id: null,
  project: null, org: null, like_count: extra.likes || 0, comment_count: extra.comments || 0,
  report_count: 0, created_at: at, edited_at: null,
});

const POSTS = [
  post('po-tall', 'update', 'Maya Chen', 'maya_chen', 'new-school', 'Poster for Thursday — tall portrait, must show whole.', [svg(900, 1350, '#7c5cbf', 'TALL 2:3')], ago(10)),
  post('po-wide', 'win', 'Jake Ramirez', 'jake_r', 'columbia', 'Screenshot of the dashboard — wide 16:9.', [svg(1600, 900, '#2f6f4f', 'WIDE 16:9')], ago(25)),
  post('po-square', 'ask', 'Hamza Harb', 'hamza', 'nyu', 'Scan to sign up — a QR must stay readable.', [svg(900, 900, '#1f2a44', 'QR 1:1')], ago(40), { mine: true }),
  post('po-two', 'update', 'Maya Chen', 'maya_chen', 'new-school', 'Two shots from the print run.', [svg(1200, 900, '#b3552e', 'A'), svg(1200, 900, '#b3552e', 'B')], ago(55)),
  post('po-three', 'update', 'Jake Ramirez', 'jake_r', 'columbia', 'Three from demo night.', [svg(1200, 900, '#585e8f', '1'), svg(900, 900, '#6a708f', '2'), svg(900, 900, '#7c82a8', '3')], ago(70)),
  post('po-four', 'win', 'Maya Chen', 'maya_chen', 'new-school', 'Full set — four tiles.', [svg(1200, 900, '#8f4f4f', '1'), svg(900, 900, '#a05b5b', '2'), svg(900, 900, '#b16868', '3'), svg(900, 900, '#c27676', '4')], ago(85)),
  post('po-thread', 'ask', 'Hamza Harb', 'hamza', 'nyu', 'THREAD marker — anyone up for a study-room finder sprint this weekend?', [], ago(100), { mine: true, comments: 4 }),
];
const COMMENTS = [
  { id: 'c-a', post_id: 'po-thread', parent_id: null, author_id: 'p-maya_chen', author_name: 'Maya Chen', author_handle: 'maya_chen', author_avatar: '', body: 'In — I can take the map screen.', report_count: 0, created_at: ago(90) },
  { id: 'c-a-r1', post_id: 'po-thread', parent_id: 'c-a', author_id: 'u-me', author_name: 'Hamza Harb', author_handle: 'hamza', author_avatar: '', body: 'perfect, the Figma is in the group chat', report_count: 0, created_at: ago(80) },
  { id: 'c-a-r2', post_id: 'po-thread', parent_id: 'c-a', author_id: 'p-jake_r', author_name: 'Jake Ramirez', author_handle: 'jake_r', author_avatar: '', body: '@maya_chen save me the data layer — long reply to test wrapping on a 360px paper card without pushing the bubble past the edge.', report_count: 0, created_at: ago(70) },
  { id: 'c-b', post_id: 'po-thread', parent_id: null, author_id: 'p-jake_r', author_name: 'Jake Ramirez', author_handle: 'jake_r', author_avatar: '', body: 'Sunday works better for me.', report_count: 0, created_at: ago(60) },
];

const respond = (route, body, single) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify(single ? (Array.isArray(body) ? (body[0] ?? null) : body) : body),
});

const checks = [];
const check = (label, ok, detail = '') => checks.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  [' + detail + ']' : ''}`);

async function preparePage(browser, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  const future = Math.floor(Date.now() / 1000) + 86400;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-me', role: 'authenticated', aud: 'authenticated', exp: future, email: 'hh@nyu.edu' })}.sig`;
  const session = { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: future, refresh_token: 'r', user: { id: 'u-me', email: 'hh@nyu.edu', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-06-01T00:00:00Z' } };

  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/user')) return respond(route, session.user);
    if (url.includes('/token')) return respond(route, session);
    return respond(route, {});
  });
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const q = url.search;
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (url.pathname.includes('/rpc/')) return respond(route, []);
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
    const table = url.pathname.split('/rest/v1/')[1];
    switch (table) {
      case 'profiles':
      case 'student_cards': return respond(route, [ME], single);
      case 'public_profiles': return respond(route, [], single);
      case 'posts': {
        const m = q.match(/id=eq\.([\w-]+)/);
        return respond(route, m ? POSTS.filter((p) => p.id === m[1]) : POSTS, single);
      }
      case 'post_comments': {
        const m = q.match(/post_id=eq\.([\w-]+)/);
        return respond(route, COMMENTS.filter((c) => c.post_id === (m ? m[1] : '')), single);
      }
      default: return respond(route, [], single);
    }
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ([t]) => {
    const m = await import('/src/lib/supabase.js');
    await m.supabase.auth.setSession({ access_token: t, refresh_token: 'r' });
  }, [jwt]);
  return { page, errors };
}

async function measure(page, tag) {
  await page.goto(BASE + '/community', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const vw = page.viewportSize().width;

  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, win: window.innerWidth,
  }));
  check(`${tag}: no horizontal overflow`, overflow.doc <= overflow.win + 1 && overflow.body <= overflow.win + 1, `doc ${overflow.doc} body ${overflow.body} win ${overflow.win}`);

  // Lone images: contain-fit, whole, inside the card, height-capped.
  for (const id of ['po-tall', 'po-wide', 'po-square']) {
    const info = await page.evaluate((pid) => {
      const imgs = [...document.querySelectorAll('.com-imgs.n1 img')];
      const img = imgs.find((i) => i.closest('.com-post') && i.closest('.com-post').textContent.includes({ 'po-tall': 'tall portrait', 'po-wide': 'wide 16:9', 'po-square': 'QR must stay readable' }[pid]));
      if (!img) return null;
      // clientWidth/Height = the layout box — immune to the cork-board card
      // tilt, which inflates getBoundingClientRect by a few px.
      return { w: img.clientWidth, h: img.clientHeight, cardW: img.closest('.com-post').clientWidth, fit: getComputedStyle(img).objectFit, nw: img.naturalWidth, nh: img.naturalHeight, complete: img.complete };
    }, id);
    if (!info) { check(`${tag}: ${id} rendered`, false, 'img not found'); continue; }
    const cap = vw <= 860 ? 361 : 561;
    check(`${tag}: ${id} contain + whole (box ${Math.round(info.w)}×${Math.round(info.h)}, natural ${info.nw}×${info.nh})`,
      info.complete && info.fit === 'contain' && info.h <= cap && info.w <= info.cardW);
  }

  // 4-grid: first tile spans all three columns, tiles 2–4 are equal thirds.
  const grid4 = await page.evaluate(() => {
    const post = [...document.querySelectorAll('.com-post')].find((p) => p.textContent.includes('Full set'));
    if (!post) return null;
    const [a, b, c, d] = [...post.querySelectorAll('.com-imgs img')].map((i) => i.getBoundingClientRect());
    return { a: a.width, b: b.width, c: c.width, d: d.width };
  });
  check(`${tag}: 4-grid keeps hero + equal thumbs`, !!grid4 && grid4.a > grid4.b * 2.5 && Math.abs(grid4.b - grid4.d) < 2,
    grid4 ? `hero ${Math.round(grid4.a)} thumbs ${Math.round(grid4.b)}/${Math.round(grid4.c)}/${Math.round(grid4.d)}` : 'post not found');

  await page.screenshot({ path: `${OUT}mob-${tag}-board.png`, fullPage: true });

  // The reply thread: open comments on the THREAD post, check indent + fit.
  const threadCard = page.locator('.com-post', { hasText: 'THREAD marker' });
  await threadCard.locator('.com-act').nth(1).click();
  await page.waitForTimeout(900);
  const thread = await page.evaluate(() => {
    const post = [...document.querySelectorAll('.com-post')].find((p) => p.textContent.includes('THREAD marker'));
    if (!post) return null;
    const replies = post.querySelector('.com-replies');
    const rows = post.querySelectorAll('.com-comment').length;
    const replyRows = post.querySelectorAll('.com-comment.reply').length;
    if (!replies) return { rows, replyRows };
    const rr = replies.getBoundingClientRect();
    const tr = replies.closest('.com-thread').getBoundingClientRect();
    const worst = Math.max(...[...post.querySelectorAll('.com-comment-bubble')].map((b) => b.getBoundingClientRect().right));
    return { rows, replyRows, indent: rr.left - tr.left, right: worst, win: window.innerWidth };
  });
  check(`${tag}: thread = 2 roots + 2 replies, indented, no bleed`,
    !!thread && thread.rows === 4 && thread.replyRows === 2 && thread.indent > 8 && thread.right <= thread.win,
    thread ? `rows ${thread.rows} replies ${thread.replyRows} indent ${Math.round(thread.indent || 0)} right ${Math.round(thread.right || 0)}/${thread.win}` : 'card not found');

  // Reply affordance: arm on a reply → chip + @prefill.
  await threadCard.locator('.com-comment.reply .com-reply-btn').first().click();
  await page.waitForTimeout(300);
  const armed = await page.evaluate(() => {
    const post = [...document.querySelectorAll('.com-post')].find((p) => p.textContent.includes('THREAD marker'));
    const chip = post && post.querySelector('.com-replying');
    const input = post && post.querySelector('.com-comment-input');
    return { chip: chip ? chip.textContent : null, val: input ? input.value : null, focused: input === document.activeElement };
  });
  check(`${tag}: reply-on-reply arms chip + @prefill`, !!armed.chip && /Replying to/.test(armed.chip) && (armed.val || '').startsWith('@'), `chip "${armed.chip}" input "${armed.val}"`);

  await threadCard.screenshot({ path: `${OUT}mob-${tag}-thread.png` });
  const clipShot = async (marker, name) => {
    const card = page.locator('.com-post', { hasText: marker });
    if (await card.count()) await card.first().screenshot({ path: `${OUT}mob-${tag}-${name}.png` });
  };
  await clipShot('tall portrait', 'tall');
  await clipShot('wide 16:9', 'wide');
  await clipShot('QR must stay readable', 'square');
  await clipShot('Full set', 'four');
}

const browser = await chromium.launch({ headless: true });
const allErrors = [];
for (const [tag, viewport] of [['360', { width: 360, height: 740 }], ['390', { width: 390, height: 844 }], ['1280', { width: 1280, height: 900 }]]) {
  const { page, errors } = await preparePage(browser, viewport);
  await measure(page, tag);
  allErrors.push(...errors);
  await page.close();
}

// Guest topbar at 360 (Sign in / Sign up cluster + the 3 tabs) on public
// Discover — the signed-in passes above never render it.
{
  const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  await page.route('**/rest/v1/**', (r) => r.request().method() === 'HEAD'
    ? r.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' })
    : respond(r, [], (r.request().headers()['accept'] || '').includes('vnd.pgrst.object')));
  await page.route('**/auth/v1/**', (r) => respond(r, {}));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  check('360 guest: no horizontal overflow', o.doc <= o.win + 1, `doc ${o.doc} win ${o.win}`);
  await page.screenshot({ path: `${OUT}mob-360-guest.png` });
  await page.close();
}
await browser.close();

console.log(checks.join('\n'));
const realErrors = allErrors.filter((e) => !/websocket|WebSocket|Failed to load resource|realtime/i.test(e));
console.log('\npage errors: ' + (realErrors.length ? '\n' + realErrors.slice(0, 6).join('\n') : '(none)'));
const failed = checks.filter((c) => c.startsWith('FAIL')).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed || realErrors.length ? 1 : 0);
