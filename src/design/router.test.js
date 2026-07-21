/* ============================================================
   NESTED NYC — router codec tests (DM Sprint 4: /messages)
   Pure ESM unit tests, run by Node's built-in test runner:
     npm test        (or:  node --test src/design/router.test.js)
   router.js has zero deps, so it imports straight into Node.
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, build, accessOf, titleFor, validateNext } from './router.js';

test('parse("/messages") → the messages route, no params', () => {
  const r = parse('/messages', '');
  assert.equal(r.route, 'messages');
  assert.deepEqual(r.params, {});
});

test('build("messages") → "/messages"', () => {
  assert.equal(build('messages', {}), '/messages');
});

test('/messages round-trips through build∘parse', () => {
  assert.equal(build(parse('/messages', '').route, {}), '/messages');
});

test('messages is a student-gated route (drives the guest auth wall)', () => {
  assert.equal(accessOf('messages'), 'student');
});

test('titleFor("messages") → "Messages · Nested NYC"', () => {
  assert.equal(titleFor('messages'), 'Messages · Nested NYC');
});

test('validateNext("/messages") accepts it as a safe internal return path', () => {
  assert.equal(validateNext('/messages'), '/messages');
});

test('parse normalizes a trailing slash and casing to the messages route', () => {
  assert.equal(parse('/messages/', '').route, 'messages');
  assert.equal(parse('/MESSAGES', '').route, 'messages');
});

test('an unknown path still parses to null (messages route is additive)', () => {
  assert.equal(parse('/definitely-not-a-route', ''), null);
});

// ---- S5: /messages/:username thread route ----

test('parse("/messages/<handle>") → messageThread with the handle param', () => {
  const r = parse('/messages/ada', '');
  assert.equal(r.route, 'messageThread');
  assert.equal(r.params.messageThreadHandle, 'ada');
});

test('build("messageThread") → /messages/<handle>; null when handle missing', () => {
  assert.equal(build('messageThread', { messageThreadHandle: 'ada' }), '/messages/ada');
  assert.equal(build('messageThread', {}), null);
});

test('messageThread is student-gated', () => {
  assert.equal(accessOf('messageThread'), 'student');
});

test('/messages and /messages/:handle are distinct routes (segment count)', () => {
  assert.equal(parse('/messages', '').route, 'messages');
  assert.equal(parse('/messages/ada', '').route, 'messageThread');
});

test('titleFor messageThread shows the peer handle, falls back to Messages', () => {
  const withName = titleFor('messageThread', { threadName: 'ada' });
  assert.ok(withName.startsWith('@ada'));
  assert.ok(withName.endsWith('Nested NYC'));
  assert.equal(titleFor('messageThread', {}), titleFor('messages'));
});

// ---- Brand showcase: /brand (internal logo preview) ----

test('parse("/brand") → the brand route, no params', () => {
  const r = parse('/brand', '');
  assert.equal(r.route, 'brand');
  assert.deepEqual(r.params, {});
});

test('/brand round-trips through build∘parse', () => {
  assert.equal(build('brand', {}), '/brand');
  assert.equal(parse(build('brand', {}), '').route, 'brand');
});

test('brand is public (anonymously browsable)', () => {
  assert.equal(accessOf('brand'), 'public');
});

test('titleFor("brand") → "Brand · Nested NYC"', () => {
  assert.equal(titleFor('brand'), 'Brand · Nested NYC');
});
