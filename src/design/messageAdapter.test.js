/* ============================================================
   NESTED NYC — message adapter tests (DM Sprint 4)
   Covers the pure transforms the inbox renders: row/inbox shaping
   (S2 contract), the relative-time formatter, and the People-join
   enrichment. Run by Node's built-in test runner:
     npm test     (or:  node --test src/design/messageAdapter.test.js)
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fromDbMessage,
  fromDbInboxRow,
  toDbMessage,
  relativeTime,
  enrichConversations,
  upsertMessage,
  mergeThread,
  bumpInboxRow,
} from './messageAdapter.js';

const ME = 'me-id';
const PEER = 'peer-id';

test('fromDbMessage: outgoing → peerId is the recipient, fromMe true', () => {
  const ui = fromDbMessage(
    { id: 'm1', sender_id: ME, recipient_id: PEER, body: 'hi', created_at: 't', read_at: null },
    ME,
  );
  assert.equal(ui.fromMe, true);
  assert.equal(ui.peerId, PEER);
  assert.equal(ui.body, 'hi');
  assert.equal(ui.readAt, null);
});

test('fromDbMessage: incoming → peerId is the sender, fromMe false, readAt kept', () => {
  const ui = fromDbMessage(
    { id: 'm2', sender_id: PEER, recipient_id: ME, body: 'yo', created_at: 't', read_at: 't2' },
    ME,
  );
  assert.equal(ui.fromMe, false);
  assert.equal(ui.peerId, PEER);
  assert.equal(ui.readAt, 't2');
});

test('fromDbMessage: null row → null', () => {
  assert.equal(fromDbMessage(null, ME), null);
});

test('fromDbInboxRow: maps fields, lastFromMe, coerces bigint-string unread', () => {
  const row = fromDbInboxRow(
    { peer_id: PEER, last_body: 'hey', last_at: 't', last_sender: ME, unread_count: '3' },
    ME,
  );
  assert.equal(row.peerId, PEER);
  assert.equal(row.lastBody, 'hey');
  assert.equal(row.lastFromMe, true);
  assert.equal(row.unreadCount, 3);
  assert.equal(typeof row.unreadCount, 'number');
});

test('fromDbInboxRow: peer-sent last message → lastFromMe false; null row → null', () => {
  const row = fromDbInboxRow(
    { peer_id: PEER, last_body: 'hey', last_at: 't', last_sender: PEER, unread_count: 0 },
    ME,
  );
  assert.equal(row.lastFromMe, false);
  assert.equal(fromDbInboxRow(null, ME), null);
});

test('toDbMessage trims; whitespace/null collapse to empty', () => {
  assert.equal(toDbMessage('  hi  ').body, 'hi');
  assert.equal(toDbMessage('   ').body, '');
  assert.equal(toDbMessage(null).body, '');
});

test('relativeTime buckets: just now / Nm / Nh / Nd / short date', () => {
  const ago = (ms) => new Date(Date.now() - ms).toISOString();
  assert.equal(relativeTime(ago(10 * 1000)), 'just now');
  assert.equal(relativeTime(ago(5 * 60 * 1000)), '5m');
  assert.equal(relativeTime(ago(3 * 60 * 60 * 1000)), '3h');
  assert.equal(relativeTime(ago(2 * 24 * 60 * 60 * 1000)), '2d');
  assert.match(relativeTime(ago(10 * 24 * 60 * 60 * 1000)), /^[A-Za-z]{3} \d{1,2}$/);
});

test('relativeTime: null/invalid → empty string', () => {
  assert.equal(relativeTime(null), '');
  assert.equal(relativeTime('not-a-date'), '');
});

test('enrichConversations: joins peer identity, preserves order + unread', () => {
  const inbox = [
    { peerId: PEER, lastBody: 'a', lastAt: 't1', lastFromMe: false, unreadCount: 2 },
    { peerId: 'ghost', lastBody: 'b', lastAt: 't2', lastFromMe: true, unreadCount: 0 },
  ];
  const people = [{ id: PEER, name: 'Ada Lovelace', avatar: 'a.png', handle: 'ada' }];
  const out = enrichConversations(inbox, people);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'Ada Lovelace');
  assert.equal(out[0].avatar, 'a.png');
  assert.equal(out[0].handle, 'ada');
  assert.equal(out[0].unreadCount, 2);
  // peer missing from the People list → graceful fallback, row still rendered
  assert.equal(out[1].name, 'Student');
  assert.equal(out[1].avatar, null);
  assert.equal(out[1].handle, null);
});

test('enrichConversations: empty / undefined inputs → []', () => {
  assert.deepEqual(enrichConversations([], []), []);
  assert.deepEqual(enrichConversations(undefined, undefined), []);
});

// ---- S5: optimistic-send thread upsert ----

test('upsertMessage appends a message whose id is new', () => {
  const out = upsertMessage([{ id: 'a' }], { id: 'b', body: 'hi' });
  assert.equal(out.length, 2);
  assert.equal(out[1].id, 'b');
});

test('upsertMessage replaces in place by id (optimistic → confirmed), order kept', () => {
  const list = [{ id: 'a', pending: true }, { id: 'b' }];
  const out = upsertMessage(list, { id: 'a', pending: false, body: 'confirmed' });
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'a');
  assert.equal(out[0].pending, false);
  assert.equal(out[0].body, 'confirmed');
  assert.equal(out[1].id, 'b');
});

test('upsertMessage is null/empty-safe', () => {
  assert.deepEqual(upsertMessage(undefined, { id: 'x' }), [{ id: 'x' }]);
  assert.deepEqual(upsertMessage([{ id: 'y' }], null), [{ id: 'y' }]);
});

// ---- S6: realtime merge (mergeThread) + inbox bump (bumpInboxRow) ----

test('mergeThread folds in new messages, dedups by id, keeps chronological order', () => {
  const existing = [{ id: 'a', createdAt: 't1' }, { id: 'b', createdAt: 't2' }];
  const fetched = [{ id: 'a', createdAt: 't1' }, { id: 'c', createdAt: 't3' }]; // 'a' echoed, 'c' new
  const out = mergeThread(existing, fetched);
  assert.deepEqual(out.map((m) => m.id), ['a', 'b', 'c']);
});

test('mergeThread is order-independent — load-then-ping == ping-then-load', () => {
  const a = { id: 'a', createdAt: 't1' };
  const b = { id: 'b', createdAt: 't2' };
  const c = { id: 'c', createdAt: 't3' };
  const loadFirst = mergeThread(mergeThread([], [a, b]), [a, b, c]); // initial load resolves first
  const pingFirst = mergeThread(mergeThread([], [a, b, c]), [a, b]); // realtime refetch resolves first
  assert.deepEqual(loadFirst, pingFirst);
  assert.deepEqual(loadFirst.map((m) => m.id), ['a', 'b', 'c']);
});

test('mergeThread: a self-sent message echoed by the refetch stays single (no dup bubble)', () => {
  const mine = { id: 'mine', createdAt: 't5', fromMe: true, body: 'hi', pending: false };
  const out = mergeThread([mine], [mine]); // get_thread returns my own row back
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'mine');
});

test('mergeThread pins a pending optimistic send last even with an earlier timestamp', () => {
  const pending = { id: 'p', createdAt: 't0', fromMe: true, pending: true }; // early client clock
  const fetched = [{ id: 'q', createdAt: 't5' }, { id: 'r', createdAt: 't6' }];
  const out = mergeThread([pending], fetched);
  assert.deepEqual(out.map((m) => m.id), ['q', 'r', 'p']); // p last, not sorted to the front
});

test('mergeThread: once confirmed, a former pending row sorts by server time (no upward hop)', () => {
  const existing = [{ id: 'a', createdAt: 't1' }, { id: 'p', createdAt: 't9', pending: true }];
  const out = mergeThread(existing, [{ id: 'p', createdAt: 't2', pending: false }]); // confirm: real time, no longer pending
  assert.deepEqual(out.map((m) => m.id), ['a', 'p']);
  assert.equal(out[1].pending, false);
  assert.equal(out[1].createdAt, 't2');
});

test('mergeThread: reconnect interleave sorts gap messages into place, dedups mine', () => {
  const existing = [{ id: 'mine', createdAt: 't10', fromMe: true }];
  const fetched = [
    { id: 'p08', createdAt: 't08' },
    { id: 'mine', createdAt: 't10', fromMe: true },
    { id: 'p12', createdAt: 't12' },
  ];
  const out = mergeThread(existing, fetched);
  assert.deepEqual(out.map((m) => m.id), ['p08', 'mine', 'p12']);
});

test('mergeThread breaks equal-timestamp ties by id for a stable order', () => {
  const out = mergeThread([], [{ id: 'b', createdAt: 't' }, { id: 'a', createdAt: 't' }]);
  assert.deepEqual(out.map((m) => m.id), ['a', 'b']);
});

test('mergeThread is null / empty-safe', () => {
  assert.deepEqual(mergeThread(null, null), []);
  assert.deepEqual(mergeThread(undefined, [{ id: 'a', createdAt: 't' }]).map((m) => m.id), ['a']);
  assert.deepEqual(mergeThread([{ id: 'a', createdAt: 't' }], null).map((m) => m.id), ['a']);
});

test('bumpInboxRow updates an existing row, moves it to the top, read clears unread', () => {
  const rows = [
    { peerId: 'A', lastBody: 'old', lastAt: 't1', lastFromMe: false, unreadCount: 3 },
    { peerId: 'B', lastBody: 'b', lastAt: 't2', lastFromMe: false, unreadCount: 0 },
  ];
  const out = bumpInboxRow(rows, 'A', { lastBody: 'new', lastAt: 't3', lastFromMe: false, read: true });
  assert.equal(out[0].peerId, 'A'); // newest lastAt floats to top
  assert.equal(out[0].lastBody, 'new');
  assert.equal(out[0].unreadCount, 0);
  assert.equal(out[1].peerId, 'B'); // unrelated row preserved
  assert.equal(out[1].lastBody, 'b');
});

test('bumpInboxRow inserts a new row when the peer is absent (read → unread 0)', () => {
  const out = bumpInboxRow([], 'C', { lastBody: 'hi', lastAt: 't', lastFromMe: false, read: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].peerId, 'C');
  assert.equal(out[0].unreadCount, 0);
});

test('bumpInboxRow: read:false increments unread on an existing row', () => {
  const rows = [{ peerId: 'A', lastBody: 'x', lastAt: 't1', lastFromMe: false, unreadCount: 2 }];
  const out = bumpInboxRow(rows, 'A', { lastBody: 'y', lastAt: 't3', lastFromMe: false, read: false });
  assert.equal(out[0].unreadCount, 3);
});

test('bumpInboxRow: read:false inserting a new row starts unread at 1', () => {
  const out = bumpInboxRow([], 'C', { lastBody: 'hi', lastAt: 't', lastFromMe: false, read: false });
  assert.equal(out[0].unreadCount, 1);
});

test('bumpInboxRow keeps the list sorted newest-first by lastAt', () => {
  const rows = [
    { peerId: 'A', lastAt: 't3', unreadCount: 0 },
    { peerId: 'B', lastAt: 't1', unreadCount: 0 },
  ];
  const out = bumpInboxRow(rows, 'B', { lastBody: 'z', lastAt: 't5', lastFromMe: true, read: true });
  assert.deepEqual(out.map((r) => r.peerId), ['B', 'A']); // B now carries the newest lastAt
});
