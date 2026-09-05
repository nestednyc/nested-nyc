/* ============================================================
   postAdapter.js pure helpers — threadComments (flat ASC list →
   one-level threads) + the comment payload/row transforms that
   carry parent_id. Pure unit test (mirrors router.test.js).
   Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threadComments, fromDbComment, toDbComment } from './postAdapter.js';

const c = (id, at, parentId = null) => ({ id, at, parentId, body: 'b' + id });

test('top-level comments pass through in order, replies: []', () => {
  const out = threadComments([c('a', '2026-08-01'), c('b', '2026-08-02')]);
  assert.deepEqual(out.map((x) => x.id), ['a', 'b']);
  assert.deepEqual(out.map((x) => x.replies), [[], []]);
});

test('replies nest under their root in list (time) order', () => {
  const out = threadComments([
    c('a', '2026-08-01'),
    c('r1', '2026-08-02', 'a'),
    c('b', '2026-08-03'),
    c('r2', '2026-08-04', 'a'),
  ]);
  assert.deepEqual(out.map((x) => x.id), ['a', 'b']);
  assert.deepEqual(out[0].replies.map((x) => x.id), ['r1', 'r2']);
  assert.deepEqual(out[1].replies, []);
});

test('a reply whose parent is hidden stands alone at top level, time-sorted', () => {
  const out = threadComments([
    c('a', '2026-08-01'),
    c('orphan', '2026-08-02', 'hidden-by-reports'),
    c('b', '2026-08-03'),
  ]);
  assert.deepEqual(out.map((x) => x.id), ['a', 'orphan', 'b']);
  assert.deepEqual(out[1].replies, []);
});

test('empty and missing input → empty thread list', () => {
  assert.deepEqual(threadComments([]), []);
  assert.deepEqual(threadComments(undefined), []);
});

test('threadComments never mutates the flat list the hook caches', () => {
  const flat = [c('a', '2026-08-01'), c('r1', '2026-08-02', 'a')];
  threadComments(flat);
  assert.equal(flat[0].replies, undefined);
  assert.equal(flat.length, 2);
});

test('comment row ⇄ payload carry parent_id / parentId', () => {
  const profile = { id: 'u1', firstName: 'Ada', lastName: 'L', username: 'ada', photos: [] };
  assert.equal(toDbComment('p1', 'hi', profile, 'root1').parent_id, 'root1');
  assert.equal(toDbComment('p1', 'hi', profile).parent_id, null);
  assert.equal(fromDbComment({ id: 'x', post_id: 'p1', parent_id: 'root1', created_at: 't' }).parentId, 'root1');
  assert.equal(fromDbComment({ id: 'x', post_id: 'p1', created_at: 't' }).parentId, null);
  assert.equal(fromDbComment({ id: 'x', post_id: 'p1', author_handle: 'ada', created_at: 't' }).authorHandle, 'ada');
});
