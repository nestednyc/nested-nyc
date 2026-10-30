/* ============================================================
   api/unsubscribe.js — the prefetch-safe opt-out endpoint.
   Proves the contract that keeps .edu link scanners from unsubscribing
   people: GET/HEAD validate the HMAC token and render a confirmation
   FORM, never touching the database; the digest token is not the
   all-email token. POST (the real write) needs a database and is
   covered by the local dry runs, not here. Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// A configured handler pointed at a dead backend, with a trip-wire fetch:
// supabase-js captures global fetch when the client is created, so the
// stub must be in place before the import.
let dbCalls = 0;
globalThis.fetch = async () => { dbCalls++; throw new Error('GET must not reach the database'); };
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
process.env.WEBHOOK_SECRET = 'unsubscribe-test-secret';
delete process.env.UNSUBSCRIBE_SECRET;
const { default: handler } = await import('../unsubscribe.js');

const USER = '11111111-1111-1111-1111-111111111111';
const sign = (kind = '') =>
  crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(kind ? `${USER}:${kind}` : USER).digest('hex');

async function call(method, query) {
  const res = {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(s) { this.statusCode = s; return this; },
    send(b) { this.body = String(b); return this; },
    json(b) { this.body = JSON.stringify(b); return this; },
  };
  await handler({ method, query, headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res);
  return res;
}

test('GET with a bad / missing token → 400, no database call', async () => {
  for (const q of [{}, { u: USER }, { u: USER, t: 'nope' }, { u: USER, t: sign().slice(0, -1) }, { u: 'someone-else', t: sign() }]) {
    const res = await call('GET', q);
    assert.equal(res.statusCode, 400, JSON.stringify(q));
    assert.ok(res.body.includes('Invalid link'));
  }
  assert.equal(dbCalls, 0);
});

test('GET with a valid token renders the confirmation form and changes nothing', async () => {
  const res = await call('GET', { u: USER, t: sign() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(res.body.includes('<meta name="robots" content="noindex">'));
  assert.ok(res.body.includes('Unsubscribe from Nested emails?'));
  assert.ok(res.body.includes('<form method="POST"'), 'the change must sit behind a POST');
  assert.ok(res.body.includes(`action="/api/unsubscribe?u=${USER}&amp;t=${sign()}"`), 'form action is the same signed link');
  assert.ok(res.body.includes('Unsubscribe me'));
  assert.equal(dbCalls, 0, 'GET touched the database');
});

test('HEAD behaves like GET (scanners only ever GET/HEAD)', async () => {
  const res = await call('HEAD', { u: USER, t: sign() });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes('<form method="POST"'));
  assert.equal(dbCalls, 0);
});

test('GET ?action=resubscribe renders the resubscribe form (still read-only)', async () => {
  const res = await call('GET', { u: USER, t: sign(), action: 'resubscribe' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.includes('Resubscribe to Nested emails?') && res.body.includes('Resubscribe me'));
  assert.ok(res.body.includes('&amp;action=resubscribe"'));
  assert.equal(dbCalls, 0);
});

test('digest links: their own HMAC, not interchangeable with the all-email token; unknown kinds are rejected', async () => {
  const digest = await call('GET', { u: USER, t: sign('digest'), kind: 'digest' });
  assert.equal(digest.statusCode, 200);
  assert.ok(digest.body.includes('Unsubscribe from the weekly digest?'));
  assert.ok(digest.body.includes('&amp;kind=digest'), 'the form must keep the kind');

  assert.equal((await call('GET', { u: USER, t: sign(), kind: 'digest' })).statusCode, 400, 'all-email token accepted for the digest');
  assert.equal((await call('GET', { u: USER, t: sign('digest') })).statusCode, 400, 'digest token accepted for all email');
  assert.equal((await call('GET', { u: USER, t: sign('other'), kind: 'other' })).statusCode, 400, 'unknown kind accepted');
  assert.equal(dbCalls, 0);
});

test('query values may arrive as arrays (repeated params) — the first one is used', async () => {
  const res = await call('GET', { u: [USER, 'x'], t: [sign(), 'y'] });
  assert.equal(res.statusCode, 200);
  assert.equal(dbCalls, 0);
});
