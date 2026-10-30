/* ============================================================
   api/_rate-limit.js — the per-IP limiter for the public endpoints.
   Configured against a dead backend with a scripted fetch, so the real
   contract is exercised: a backend error or exception → ALLOW (fail
   open), a backend answer → that answer. clientIp()'s header handling
   too. The unconfigured case (no key → no client) lives in
   rate-limit-unconfigured.test.js, since the client is built at import.
   Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// supabase-js captures global fetch when the client is created, so the
// scripted fetch must be installed before the import.
let calls = 0;
let answer = () => { throw new Error('backend down'); };
globalThis.fetch = async (...args) => { calls++; return answer(...args); };
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
const { limit, clientIp } = await import('../_rate-limit.js');

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

test('clientIp: first X-Forwarded-For hop wins (string or array), trimmed; socket address, then "unknown"', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), '203.0.113.9');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': ['198.51.100.2, 10.0.0.1', '9.9.9.9'] } }), '198.51.100.2');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '  1.2.3.4  ' } }), '1.2.3.4');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '::1' } }), '::1');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '' }, socket: { remoteAddress: '10.1.1.1' } }), '10.1.1.1');
  assert.equal(clientIp({ headers: {} }), 'unknown');
});

test('limit: a backend that throws → allowed (fail open), and the backend was actually asked', async () => {
  const before = calls;
  answer = () => { throw new Error('connection refused'); };
  assert.equal(await limit('check-email:1.2.3.4', 60, 600), true);
  assert.equal(calls, before + 1, 'limit() must call the rate_limit_hit RPC');
});

test('limit: a backend error response → allowed (fail open)', async () => {
  answer = () => new Response(JSON.stringify({ message: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } });
  assert.equal(await limit('check-email:1.2.3.4', 60, 600), true);
});

test('limit: the backend\'s verdict is honoured — true allows, false denies, anything else allows', async () => {
  answer = () => json(true);
  assert.equal(await limit('unsubscribe:1.2.3.4', 20, 60), true);
  answer = () => json(false);
  assert.equal(await limit('unsubscribe:1.2.3.4', 20, 60), false, 'an exhausted window must deny');
  answer = () => json(null);
  assert.equal(await limit('unsubscribe:1.2.3.4', 20, 60), false, 'rate_limit_hit returns a boolean; anything else is not an allow');
});

test('limit: sends the key, cap and window to rate_limit_hit', async () => {
  let seen;
  answer = (url, init) => { seen = { url: String(url), body: JSON.parse(init.body) }; return json(true); };
  await limit('prerender:9.9.9.9', 120, 60);
  assert.match(seen.url, /\/rest\/v1\/rpc\/rate_limit_hit$/);
  assert.deepEqual(seen.body, { p_key: 'prerender:9.9.9.9', p_max: 120, p_window_sec: 60 });
});
