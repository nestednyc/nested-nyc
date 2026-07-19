/* ============================================================
   data.js pure helpers — resolveOrgUniSlug (org row → client-taxonomy
   campus slug) + the username-led naming pair bareHandle/personLabel.
   Pure unit test (mirrors router.test.js). Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrgUniSlug, bareHandle, personLabel } from './data.js';

// Universities as orgService.listUniversities() returns them. 'baruch' is
// seeded in the DB but NOT in the 18-entry client taxonomy (UNI), so it must
// resolve to null — the CUNY-sub-school edge.
const UNIS = [
  { id: 'u-nyu', slug: 'nyu', name: 'New York University' },
  { id: 'u-baruch', slug: 'baruch', name: 'Baruch College (CUNY)' },
];

test('university-type org keys off its own slug', () => {
  assert.equal(resolveOrgUniSlug({ type: 'university', slug: 'nyu' }, UNIS), 'nyu');
});

test('university-type org whose slug is not in the taxonomy → null', () => {
  assert.equal(resolveOrgUniSlug({ type: 'university', slug: 'baruch' }, UNIS), null);
});

test('club resolves its campus via university_id', () => {
  assert.equal(resolveOrgUniSlug({ type: 'club', university_id: 'u-nyu' }, UNIS), 'nyu');
});

test('club whose parent is not in the taxonomy → null', () => {
  assert.equal(resolveOrgUniSlug({ type: 'club', university_id: 'u-baruch' }, UNIS), null);
});

test('club with an unknown university_id → null', () => {
  assert.equal(resolveOrgUniSlug({ type: 'club', university_id: 'nope' }, UNIS), null);
});

test('other-type org with no campus → null', () => {
  assert.equal(resolveOrgUniSlug({ type: 'other' }, UNIS), null);
});

test('null org → null (no throw)', () => {
  assert.equal(resolveOrgUniSlug(null, UNIS), null);
});

test('empty universities list → null (no throw)', () => {
  assert.equal(resolveOrgUniSlug({ type: 'club', university_id: 'u-nyu' }, []), null);
});

test('missing universities arg → null (no throw)', () => {
  assert.equal(resolveOrgUniSlug({ type: 'club', university_id: 'u-nyu' }), null);
});

// ── username-led naming helpers (bareHandle / personLabel) ──

test('bareHandle strips leading @s and stringifies safely', () => {
  assert.equal(bareHandle('maya'), 'maya');
  assert.equal(bareHandle('@maya'), 'maya');
  assert.equal(bareHandle('@@maya'), 'maya'); // legacy double-@ row
  assert.equal(bareHandle(''), '');
  assert.equal(bareHandle(null), '');
  assert.equal(bareHandle(undefined), '');
});

test('personLabel leads with @username on DB-shape rows', () => {
  assert.equal(personLabel({ username: 'maya', first_name: 'Maya', last_name: 'Chen' }), '@maya');
});

test('personLabel never double-prefixes a legacy @-carrying username', () => {
  assert.equal(personLabel({ username: '@maya' }), '@maya');
});

test('personLabel falls back to the full name (DB shape)', () => {
  assert.equal(personLabel({ username: null, first_name: 'Maya', last_name: 'Chen' }), 'Maya Chen');
  assert.equal(personLabel({ username: '', first_name: 'Maya' }), 'Maya');
});

test('personLabel reads cork-board camelCase rows too', () => {
  assert.equal(personLabel({ username: '', firstName: 'Maya', lastName: 'Chen' }), 'Maya Chen');
  assert.equal(personLabel({ firstName: 'Maya' }, 'Lead'), 'Maya');
});

test('personLabel collapses stray whitespace in names', () => {
  assert.equal(personLabel({ first_name: ' Maya ', last_name: '' }), 'Maya');
});

test('personLabel fallback: default and per-caller', () => {
  assert.equal(personLabel({}), 'Someone');
  assert.equal(personLabel(null), 'Someone');
  assert.equal(personLabel(null, 'Team Member'), 'Team Member');
  assert.equal(personLabel({}, 'Lead'), 'Lead');
});
