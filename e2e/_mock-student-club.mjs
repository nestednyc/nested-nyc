// The club-owner mock session (no local Supabase needed): canned PostgREST
// answers render the real app signed-in as @hamza, owner of "Club A"
// (unverified), with "Club B" (someone else's, stamped) and the NYU anchor row
// alongside. Shared by student-clubs-mock.mjs and mode-switch-check.mjs —
// `wire(page)` routes auth + rest and signs in through the client itself.
// Gotchas: honor the vnd.pgrst.object Accept header (bare object vs array);
// id=in.(…) arrives percent-encoded; fixture university / category ids must be
// real UNI / CAT keys from src/design/data.js.
export const BASE = process.env.BASE_URL || 'http://localhost:5173';

export const person = (id, username, first, last, uni) => ({
  id, username, first_name: first, last_name: last, university: uni,
  account_type: 'student', onboarding_completed: true, avatar: null, photos: [],
  skills: [], fields: [], links: {}, major: 'CS', year: "'27", bio: 'Building things.',
  building: '', created_at: '2026-06-01T00:00:00Z',
});
export const ME = person('u-me', 'hamza', 'Hamza', 'Harb', 'nyu');
export const P1 = person('p1', 'maya.chen', 'Maya', 'Chen', 'new-school');
export const ALL = [ME, P1];
export const PUB = ALL.map((p) => ({ id: p.id, username: p.username, first_name: p.first_name, last_name: p.last_name, avatar: null, university: p.university }));

export const UNI = { id: 'uni-nyu', slug: 'nyu', name: 'New York University', type: 'university', verified: true, owner_user_id: null, university_id: null, logo: null, bio: null, location: 'New York, NY', links: [], join_questions: [], join_url: null, spotlight_until: null, created_at: '2026-05-26T00:00:00Z' };
export const CLUB_A = { id: 'club-a', slug: 'club-a', name: 'Club A', type: 'club', verified: false, owner_user_id: 'u-me', university_id: 'uni-nyu', logo: null, bio: 'Robots on Thursdays.', location: 'NYU Tandon', links: [], join_questions: [], join_url: null, spotlight_until: null, created_at: '2026-09-01T00:00:00Z' };
export const CLUB_B = { id: 'club-b', slug: 'club-b', name: 'Club B', type: 'club', verified: true, owner_user_id: 'p1', university_id: 'uni-nyu', logo: null, bio: 'Somebody else runs this one.', location: 'Brooklyn', links: [], join_questions: [], join_url: null, spotlight_until: null, created_at: '2026-08-01T00:00:00Z' };
export const ORGS = [UNI, CLUB_A, CLUB_B];
export const orgEmbed = (o) => ({ id: o.id, slug: o.slug, name: o.name, logo: o.logo, verified: o.verified, type: o.type, university_id: o.university_id });

export const EV_A = {
  id: 'ev-a', title: 'Robot Night', event_type: 'demo', date: '2026-12-01', time: '18:00', start_time: '18:00',
  end_time: '21:00', location: 'Tandon MakerSpace', address: '', description: 'Bring a bot.', highlights: [], tags: [],
  attendees: 0, max_attendees: null, is_past: false, organization_id: 'club-a', organizer_id: 'u-me', organizer_name: 'Club A',
  questions: [], created_at: '2026-09-02T00:00:00Z', organization: orgEmbed(CLUB_A), my_reg: [],
};

export const respond = (route, body, single) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify(single ? (Array.isArray(body) ? (body[0] ?? null) : body) : body),
});
export const inSet = (s, key = 'id') => { const m = s.match(new RegExp(key + '=in\\.(?:%28|\\()(.*?)(?:%29|\\))', 'i')); return m ? decodeURIComponent(m[1]).replace(/"/g, '').split(',') : []; };

export async function wire(page) {
  const future = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u-me', role: 'authenticated', aud: 'authenticated', exp: future, email: 'hh@nyu.edu' })}.sig`;
  const session = {
    access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: future, refresh_token: 'r',
    user: { id: 'u-me', email: 'hh@nyu.edu', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-06-01T00:00:00Z' },
  };
  await page.route('**/auth/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/user')) return respond(route, session.user);
    if (url.includes('/token')) return respond(route, session);
    return respond(route, {});
  });
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const q = url.search;
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
    if (path.includes('/rpc/')) {
      const fn = path.split('/rpc/')[1];
      if (fn === 'org_follower_count' || fn === 'org_member_count') return respond(route, 0);
      if (fn === 'is_blocked_with') return respond(route, false);
      return respond(route, []);
    }
    const table = path.split('/rest/v1/')[1];
    switch (table) {
      case 'profiles':
      case 'student_cards': {
        if (q.includes('id=eq.')) { const id = q.match(/id=eq\.([\w-]+)/)[1]; return respond(route, ALL.filter((p) => p.id === id), single); }
        if (q.includes('id=in.')) { const set = inSet(q); return respond(route, ALL.filter((p) => set.includes(p.id)), single); }
        return respond(route, ALL, single);
      }
      case 'public_profiles': {
        if (q.includes('id=in.')) { const set = inSet(q); return respond(route, PUB.filter((p) => set.includes(p.id)), single); }
        return respond(route, PUB, single);
      }
      case 'organizations': {
        if (q.includes('owner_user_id=eq.u-me')) return respond(route, [CLUB_A], single);
        if (q.includes('type=eq.university')) return respond(route, [UNI], single);
        if (q.includes('slug=eq.')) { const s = decodeURIComponent(q.match(/slug=eq\.([^&]+)/)[1]); return respond(route, ORGS.filter((o) => o.slug === s), single); }
        if (q.includes('id=eq.')) { const id = q.match(/id=eq\.([\w-]+)/)[1]; return respond(route, ORGS.filter((o) => o.id === id), single); }
        if (q.includes('id=in.')) { const set = inSet(q); return respond(route, ORGS.filter((o) => set.includes(o.id)), single); }
        if (q.includes('spotlight_until')) return respond(route, [], single);
        return respond(route, ORGS, single);
      }
      case 'events': {
        if (q.includes('organization_id=in.')) { const set = inSet(q, 'organization_id'); return respond(route, set.includes('club-a') ? [EV_A] : [], single); }
        if (q.includes('id=eq.ev-a')) return respond(route, [EV_A], single);
        return respond(route, [EV_A], single);
      }
      case 'event_rsvp_answers':
      case 'event_registrations':
      case 'projects':
      case 'team_members':
      case 'connections':
      case 'saved_projects':
      case 'posts':
      case 'post_likes':
      case 'post_saves':
      case 'post_comments':
      case 'org_follows':
      case 'org_memberships':
      case 'notifications':
      default: return respond(route, [], single);
    }
  });
  // Sign in through the client itself — setSession persists the canonical blob.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ([t]) => {
    const m = await import('/src/lib/supabase.js');
    await m.supabase.auth.setSession({ access_token: t, refresh_token: 'r' });
  }, [jwt]);
}
