/* ============================================================
   data.js pure helpers — resolveOrgUniSlug (org row → client-taxonomy
   campus slug) + the username-led naming pair bareHandle/personLabel.
   Pure unit test (mirrors router.test.js). Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrgUniSlug, bareHandle, personLabel, detectProjectLink, cleanProjectLinks, PROJECT_LINK_MAX } from './data.js';

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

// ── project links (detectProjectLink / cleanProjectLinks) ──

test('bare domain → https-normalized site link labeled by its domain', () => {
  assert.deepEqual(detectProjectLink('subwaypulse.nyc'),
    { kind: 'site', label: 'subwaypulse.nyc', url: 'https://subwaypulse.nyc' });
});

test('www. is stripped from the label, kept in the url', () => {
  assert.deepEqual(detectProjectLink('www.subwaypulse.nyc'),
    { kind: 'site', label: 'subwaypulse.nyc', url: 'https://www.subwaypulse.nyc' });
});

test('known platforms brand the pill', () => {
  assert.equal(detectProjectLink('https://www.instagram.com/subwaypulse').label, 'Instagram');
  assert.equal(detectProjectLink('https://github.com/team/repo').kind, 'github');
  assert.equal(detectProjectLink('apps.apple.com/us/app/id123').label, 'App Store');
  assert.equal(detectProjectLink('https://youtu.be/abc123').label, 'YouTube');
  assert.equal(detectProjectLink('x.com/subwaypulse').label, 'X / Twitter');
});

test('platform subdomains still match (someone.substack.com)', () => {
  assert.equal(detectProjectLink('someone.substack.com').label, 'Substack');
  assert.equal(detectProjectLink('https://team.notion.site/page').label, 'Notion');
});

test('an existing http(s) scheme is preserved as typed', () => {
  assert.equal(detectProjectLink('http://legacy.site').url, 'http://legacy.site');
});

test('a schemeless host:port is prefixed, not mistaken for a scheme', () => {
  assert.deepEqual(detectProjectLink('myproject.club:8080/demo'),
    { kind: 'site', label: 'myproject.club', url: 'https://myproject.club:8080/demo' });
  assert.equal(detectProjectLink('localhost:5173'), null); // dot-less host still drops
});

test('a bare @handle resolves as an Instagram profile', () => {
  assert.deepEqual(detectProjectLink('@nyu.robotics'),
    { kind: 'instagram', label: 'Instagram', url: 'https://instagram.com/nyu.robotics' });
  assert.equal(detectProjectLink('@nyuairclub').url, 'https://instagram.com/nyuairclub');
  // dedupes against the pasted-URL form of the same handle
  assert.equal(detectProjectLink('@nyu.robotics').url,
    detectProjectLink('https://instagram.com/nyu.robotics').url);
});

test('@handle edge cases: malformed handles never resolve as Instagram', () => {
  assert.equal(detectProjectLink('@'), null);
  assert.equal(detectProjectLink('@has spaces'), null);
  assert.equal(detectProjectLink('@' + 'a'.repeat(31)), null); // >30 chars, and no dot for the host path
  // boundary dots miss the handle regex; they may fall through to a harmless
  // site pill, but must never be branded Instagram
  const leading = detectProjectLink('@.leading.dot');
  assert.ok(!leading || leading.kind !== 'instagram');
  const trailing = detectProjectLink('@trailing.dot.');
  assert.ok(!trailing || trailing.kind !== 'instagram');
  // only a LEADING @ is a handle — an email-looking string is unchanged (site)
  assert.equal(detectProjectLink('name@domain.com').kind, 'site');
});

test('non-http schemes and junk are rejected', () => {
  assert.equal(detectProjectLink('javascript:alert(1)'), null);
  assert.equal(detectProjectLink('mailto:team@nyu.edu'), null);
  assert.equal(detectProjectLink('ftp://files.site.com'), null);
  assert.equal(detectProjectLink('not a url'), null);
  assert.equal(detectProjectLink('instagram'), null); // no dot — not a real host
  assert.equal(detectProjectLink(''), null);
  assert.equal(detectProjectLink(null), null);
  assert.equal(detectProjectLink('a'.repeat(301) + '.com'), null); // oversized
});

test('cleanProjectLinks drops invalid rows, dedupes by url, caps the list', () => {
  const cleaned = cleanProjectLinks([
    'subwaypulse.nyc',
    '', 'not a url',
    'subwaypulse.nyc',                 // duplicate
    { url: 'https://github.com/team' } // object shape (DB row)
  ]);
  assert.deepEqual(cleaned.map((l) => l.url),
    ['https://subwaypulse.nyc', 'https://github.com/team']);
  const many = cleanProjectLinks(
    Array.from({ length: 10 }, (_, i) => 'site' + i + '.com'));
  assert.equal(many.length, PROJECT_LINK_MAX);
});

test('cleanProjectLinks tolerates non-array input', () => {
  assert.deepEqual(cleanProjectLinks(null), []);
  assert.deepEqual(cleanProjectLinks(undefined), []);
  assert.deepEqual(cleanProjectLinks('subwaypulse.nyc'), []);
});
