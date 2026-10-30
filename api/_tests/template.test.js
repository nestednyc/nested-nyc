/* ============================================================
   api/_email/template.js — the one email shell + its eleven builders.
   Pure (no network, no Supabase): proves the escaping of user-supplied
   strings, the avatar trust rule (only this project's public storage
   becomes an <img>), the unsubscribe footer, and that every builder
   renders from a full argument set without leaking undefined/null.
   Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The shell reads its env at import: the project host that avatars must
// come from (prod sets SUPABASE_URL for every api/ function) and the
// local-preview logo override, which production never sets.
process.env.SUPABASE_URL = 'https://abc.supabase.co';
delete process.env.EMAIL_LOGO_URL;
const { renderEmail, emails } = await import('../_email/template.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://www.nested.social';
const STORAGE_AVATAR = 'https://abc.supabase.co/storage/v1/object/public/avatars/u1/a.jpg';
const UNSUB = `${SITE}/api/unsubscribe?u=u1&t=abc`;

// One complete argument set per builder.
const SAMPLES = {
  joinRequest:      { requesterName: 'Ada Lovelace', school: 'NYU', role: 'Designer', projectTitle: 'Loom', projectId: 'p1', message: 'Hi there', avatarUrl: STORAGE_AVATAR, unsubUrl: UNSUB },
  joinApproved:     { ownerName: 'Grace Hopper', role: 'Designer', projectTitle: 'Loom', projectId: 'p1', avatarUrl: null, unsubUrl: UNSUB },
  clubJoinRequest:  { applicantName: 'Ada Lovelace', school: 'NYU', clubName: 'Film Club', clubSlug: 'film-club', avatarUrl: null, unsubUrl: UNSUB },
  clubJoinAccepted: { clubName: 'Film Club', clubSlug: 'film-club', unsubUrl: UNSUB },
  newConnection:    { sourceName: 'Ada Lovelace', school: 'NYU', sourceUsername: 'ada', avatarUrl: null, unsubUrl: UNSUB },
  newMessage:       { senderName: 'Ada Lovelace', school: 'NYU', senderUsername: 'ada', avatarUrl: null, unsubUrl: UNSUB },
  introReply:       { replierName: 'Ada Lovelace', school: 'NYU', replierUsername: 'ada', avatarUrl: null, unsubUrl: UNSUB },
  newReport:        { reporterName: 'Ada Lovelace', reporterSchool: 'NYU', targetLabel: 'a post by @bob', excerpt: 'spam spam', reason: 'spam', targetType: 'post', targetId: 'post1' },
  newOrg:           { name: 'Film Club', type: 'club', slug: 'film-club', location: 'Brooklyn', bio: 'We watch films.', ownerEmail: 'owner@nyu.edu', school: 'NYU', studentRun: false },
  weeklyDigest:     { firstName: 'Ada', school: 'NYU', posts: [{ label: 'A win', sub: 'by @ada', url: `${SITE}/community/1` }], events: [{ label: 'Demo night', sub: 'Thu 7pm', url: `${SITE}/events/e1` }], flyers: [], unsubUrl: UNSUB, digestUnsubUrl: `${UNSUB}&kind=digest` },
  orgVerified:      { orgName: 'Film Club', orgSlug: 'film-club', unsubUrl: UNSUB },
};

test('every builder renders a subject + a complete HTML document from a full argument set', () => {
  assert.deepEqual(Object.keys(emails).sort(), Object.keys(SAMPLES).sort(), 'a builder was added or removed — update SAMPLES');
  for (const [name, args] of Object.entries(SAMPLES)) {
    const { subject, html } = emails[name](args);
    assert.ok(typeof subject === 'string' && subject.trim(), `${name}: empty subject`);
    assert.ok(html.startsWith('<!DOCTYPE html>') && html.trimEnd().endsWith('</html>'), `${name}: not a full document`);
    assert.doesNotMatch(html, /\b(undefined|null|NaN)\b|\[object Object\]/, `${name}: a value leaked into the html`);
    assert.match(html, new RegExp(`href="${SITE}/`), `${name}: CTA does not point at the site`);
    assert.ok(html.includes('<title>'), `${name}: no title`);
  }
});

test('user-supplied strings are escaped everywhere they land; the subject stays plain text', () => {
  const hostile = '<script>alert(1)</script> & "Co" <img src=x onerror=1>';
  const { subject, html } = emails.joinRequest({ ...SAMPLES.joinRequest, requesterName: hostile, message: hostile, projectTitle: hostile });
  assert.ok(!html.includes('<script>'), 'raw <script> reached the html');
  assert.ok(!html.includes('<img src=x'), 'raw <img> reached the html');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;'), 'escaped form missing');
  assert.ok(subject.includes(hostile), 'the subject is plain text — it must not be HTML-escaped');
});

test('avatar trust rule: only an https URL on the configured project host under /storage/v1/object/public/ becomes an <img>', () => {
  const trusted = emails.newConnection({ ...SAMPLES.newConnection, avatarUrl: STORAGE_AVATAR }).html;
  assert.ok(trusted.includes(`<img src="${STORAGE_AVATAR}"`), 'storage avatar not rendered');
  assert.ok(!/>AL<\/div>/.test(trusted), 'disc must not render alongside the photo');

  const rejected = [
    'https://evil.example/x.png',
    'https://evil.example/storage/v1/object/public/avatars/u1/a.jpg',      // the marker on a foreign host
    'https://other.supabase.co/storage/v1/object/public/avatars/u1/a.jpg', // another project
    'https://abc.supabase.co.evil.example/storage/v1/object/public/a.jpg', // host prefix trick
    'https://abc.supabase.co/evil/../storage/v1/object/public/a.jpg',      // not under the public prefix
    'https://abc.supabase.co/storage/v1/object/sign/avatars/u1/a.jpg',     // signed, not public
    'http://abc.supabase.co/storage/v1/object/public/avatars/u1/a.jpg',    // not https
    'javascript:alert(1)', 'not a url', '', null, undefined,
  ];
  for (const bad of rejected) {
    const html = emails.newConnection({ ...SAMPLES.newConnection, sourceName: 'Ada Lovelace', avatarUrl: bad }).html;
    assert.ok(!html.includes('<img src="http'), `an <img> was rendered for ${String(bad)}`);
    if (bad) assert.ok(!html.includes(String(bad).replace(/&/g, '&amp;')), `untrusted avatar URL leaked: ${bad}`);
    assert.ok(/>AL<\/div>/.test(html), `initials disc missing for ${String(bad)}`);
  }
  // initials: "@" stripped, split on . _ - and spaces; one word → one letter; nothing → "N"
  const disc = (name) => renderEmail({ heading: 'h', body: 'b', ctaLabel: 'c', ctaUrl: '/', actor: { name } });
  assert.ok(/>AL<\/div>/.test(disc('@ada_lovelace')));
  assert.ok(/>A<\/div>/.test(disc('Ada')));
  assert.ok(/>N<\/div>/.test(disc('')));
});

test('footer: the per-recipient unsubscribe link when given, the preferences page otherwise, digest links replace both', () => {
  const withUnsub = emails.newMessage(SAMPLES.newMessage).html;
  assert.ok(withUnsub.includes('href="https://www.nested.social/api/unsubscribe?u=u1&amp;t=abc"'), 'unsub link missing (or not attribute-escaped)');
  assert.ok(withUnsub.includes('Manage email preferences'));

  const internal = emails.newReport(SAMPLES.newReport).html;
  assert.ok(internal.includes(`href="${SITE}/profile"`), 'internal mail should fall back to the preferences page');
  assert.ok(!internal.includes('/api/unsubscribe'), 'internal mail must not carry an unsubscribe link');

  const digest = emails.weeklyDigest(SAMPLES.weeklyDigest).html;
  assert.ok(digest.includes('Unsubscribe from the weekly digest') && digest.includes('kind=digest'));
  assert.ok(digest.includes('All email preferences'));
  assert.ok(!digest.includes('Manage email preferences'), 'footerLinks must replace the default link');
});

test('weeklyDigest: items render as links, empty sections vanish, the school lands in the subject', () => {
  const { subject, html } = emails.weeklyDigest(SAMPLES.weeklyDigest);
  assert.equal(subject, 'This week on the board at NYU');
  assert.ok(html.includes(`href="${SITE}/community/1"`) && html.includes('A win') && html.includes('by @ada'));
  assert.ok(html.includes('// on the board') && html.includes('// coming up'));
  assert.ok(!html.includes('// new flyers'), 'an empty section must not render its title');
  assert.equal(emails.weeklyDigest({ ...SAMPLES.weeklyDigest, school: '' }).subject, 'This week on the board');
});

test('newOrg: the student-run variant names the founder; both carry the takedown SQL for the slug', () => {
  const plain = emails.newOrg(SAMPLES.newOrg);
  assert.equal(plain.subject, 'New org is live: Film Club');
  assert.ok(plain.html.includes('// new org'));
  assert.ok(plain.html.includes('delete from public.organizations where slug = ') && plain.html.includes('film-club'), 'takedown SQL missing');

  const student = emails.newOrg({ ...SAMPLES.newOrg, studentRun: true, founder: { name: 'Ada Lovelace', handle: 'ada', school: 'NYU', avatarUrl: null } });
  assert.equal(student.subject, 'New student-run club is live: Film Club');
  assert.ok(student.html.includes('// student-run club'));
  assert.ok(student.html.includes('Founded by Ada Lovelace (@ada, NYU)'));
  assert.ok(/>AL<\/div>/.test(student.html), 'founder identity row missing');
  // a handle-only founder (personLabel already yields "@handle") is not doubled
  const handleOnly = emails.newOrg({ ...SAMPLES.newOrg, studentRun: true, founder: { name: '@ada', handle: 'ada' } }).html;
  assert.ok(handleOnly.includes('Founded by @ada') && !handleOnly.includes('(@ada'));
});

test('newReport clips a long excerpt to 277 chars + an ellipsis', () => {
  const long = 'x'.repeat(400);
  const { html } = emails.newReport({ ...SAMPLES.newReport, excerpt: long });
  assert.ok(html.includes('x'.repeat(277) + '…'));
  assert.ok(!html.includes('x'.repeat(278)));
});

test('band logo: the html references /email/nested-mark-ivory.png and the file exists under public/', () => {
  const html = emails.clubJoinAccepted(SAMPLES.clubJoinAccepted).html;
  assert.ok(html.includes(`src="${SITE}/email/nested-mark-ivory.png"`), 'logo URL changed');
  // The SPA rewrite answers any missing path with index.html — a silently broken image.
  assert.ok(existsSync(path.join(ROOT, 'public', 'email', 'nested-mark-ivory.png')), 'public/email/nested-mark-ivory.png is missing');
});

test('renderEmail: sections with no items are dropped, the preheader falls back to the heading', () => {
  const html = renderEmail({ heading: 'Hello <there>', body: 'b', ctaLabel: 'Go', ctaUrl: '/x', sections: [{ title: 'empty', items: [] }, { title: 'kept', items: [{ label: 'L', url: '/l' }] }] });
  assert.ok(!html.includes('// empty') && html.includes('// kept'));
  assert.ok(html.includes('<title>Hello &lt;there&gt;</title>'));
  assert.ok(html.includes('>Hello &lt;there&gt;</div>'), 'preheader should fall back to the heading');
});
