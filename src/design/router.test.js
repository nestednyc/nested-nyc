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

// ---------- community board routes ----------
test('parse("/community") → the community route, no params', () => {
  const r = parse('/community', '');
  assert.equal(r.route, 'community');
  assert.deepEqual(r.params, {});
});

test('build("community") → "/community"', () => {
  assert.equal(build('community', {}), '/community');
});

test('community is student-gated; the org seat is org-gated', () => {
  assert.equal(accessOf('community'), 'student');
  assert.equal(accessOf('orgCommunity'), 'org');
});

test('parse("/dashboard/community") → orgCommunity and builds back', () => {
  assert.equal(parse('/dashboard/community', '').route, 'orgCommunity');
  assert.equal(build('orgCommunity', {}), '/dashboard/community');
});

test('titleFor community routes', () => {
  assert.equal(titleFor('community'), 'Community · Nested NYC');
  assert.equal(titleFor('orgCommunity'), 'Community · Nested NYC');
});

test('post permalink /community/:id round-trips and is student-gated', () => {
  const r = parse('/community/abc-123', '');
  assert.equal(r.route, 'communityPost');
  assert.deepEqual(r.params, { postViewId: 'abc-123' });
  assert.equal(build('communityPost', { postViewId: 'abc-123' }), '/community/abc-123');
  assert.equal(build('communityPost', {}), null);
  assert.equal(accessOf('communityPost'), 'student');
  assert.equal(titleFor('communityPost'), 'Post · Nested NYC');
});

test('event RSVP responses route (org) round-trips', () => {
  const r = parse('/dashboard/events/abc/rsvps', '');
  assert.equal(r.route, 'eventResponses');
  assert.deepEqual(r.params, { eventDraftId: 'abc' });
  assert.equal(build('eventResponses', { eventDraftId: 'abc' }), '/dashboard/events/abc/rsvps');
  assert.equal(accessOf('eventResponses'), 'org');
  assert.equal(titleFor('eventResponses'), 'RSVPs · Nested NYC');
  assert.equal(parse('/dashboard/members', '').route, 'orgMembers');
  assert.equal(build('orgMembers', {}), '/dashboard/members');
  assert.equal(accessOf('orgMembers'), 'org');
  assert.equal(titleFor('orgMembers'), 'Applications · Nested NYC');
});
