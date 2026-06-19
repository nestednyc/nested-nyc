# Email notifications

Transactional emails for Nested, sent from Vercel serverless functions when
Supabase rows change. Four notifications today:

| Trigger (Supabase) | Email | Recipient |
|---|---|---|
| `team_members` INSERT (status `pending`) | Join request | Project owner + co-leads (`projects.admins`) |
| `team_members` UPDATE (→ `approved`) | You're in | The requester |
| `connections` INSERT | New connection | The target |
| `organizations` UPDATE (verified → `true`) | You're verified | The org owner |

## Architecture

- `api/_email/template.js` — one `renderEmail()` shell + the four `emails.*`
  builders (each returns `{ subject, html }`). All email copy lives here.
- `api/notify.js` — the webhook receiver. Verifies the `x-webhook-secret`
  header, looks up recipient emails (service role → `auth.admin.getUserById`)
  and `email_opt_out`, then sends via Resend. Skips opted-out recipients.
- `api/unsubscribe.js` — tokenized one-click opt-out (sets `profiles.email_opt_out`).
- `email-preview/` — local-only: `node email-preview/build-preview.mjs` renders
  the templates to HTML/PNG for eyeballing. Not shipped.

## Environment variables

Set all of these in **Vercel → Project → Settings → Environment Variables**, for
both **Production** and **Preview**. None are `VITE_`-prefixed — they must never
reach the browser.

| Var | What |
|---|---|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL`, without the prefix |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key (secret) |
| `RESEND_VERCEL_KEY` | Resend → API Keys (named this in Vercel to avoid clashing with Supabase Auth's `RESEND_API_KEY`; `notify.js` also accepts `RESEND_API_KEY`) |
| `WEBHOOK_SECRET` | A long random string; the webhooks send it as the `x-webhook-secret` header |
| `EMAIL_FROM` | `Nested <hi@nested.social>` (the domain must be verified in Resend) |
| `APP_URL` | `https://www.nested.social` (used to build links inside emails) |
| `UNSUBSCRIBE_SECRET` | Optional; HMAC key for unsubscribe links (defaults to `WEBHOOK_SECRET`) |

## 1. Resend

1. Create a Resend account and **add + verify the `nested.social` domain**
   (Resend → Domains → add the DNS records). Sending from `hi@nested.social`
   fails until the domain is verified.
2. Create an API key → set `RESEND_API_KEY` in Vercel.

## 2. Database migration

Apply `supabase/migrations/20260618000000_email_opt_out.sql` (adds
`profiles.email_opt_out`). ⚠️ Prod schema can drift from this folder — confirm
the column exists in prod (Supabase → Table editor) rather than trusting
`supabase db push` blindly. The migration is idempotent (`ADD COLUMN IF NOT EXISTS`).

## 3. Webhooks (Supabase → Database → Webhooks)

Create **three** webhooks, all pointing at `https://www.nested.social/api/notify`,
HTTP method **POST**, each with an HTTP header `x-webhook-secret: <WEBHOOK_SECRET>`:

| Name | Table | Events |
|---|---|---|
| `notify_team_members` | `team_members` | Insert, Update |
| `notify_connections` | `connections` | Insert |
| `notify_organizations` | `organizations` | Update |

`notify.js` filters precisely (pending inserts, the pending→approved flip, the
verified false→true flip), so it is safe for the webhooks to fire broadly.

<details><summary>Equivalent SQL (reference only — the dashboard is the supported path)</summary>

Supabase Database Webhooks are triggers that call `supabase_functions.http_request`.
Create them via the dashboard; this is for version-controlled reference.

```sql
create trigger notify_team_members
  after insert or update on public.team_members
  for each row execute function supabase_functions.http_request(
    'https://www.nested.social/api/notify', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}', '5000');

create trigger notify_connections
  after insert on public.connections
  for each row execute function supabase_functions.http_request(
    'https://www.nested.social/api/notify', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}', '5000');

create trigger notify_organizations
  after update on public.organizations
  for each row execute function supabase_functions.http_request(
    'https://www.nested.social/api/notify', 'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}', '5000');
```
</details>

## 4. Deploy order (matters — `main` auto-deploys to prod)

1. Set the env vars (Production + Preview).
2. Apply the migration.
3. Deploy a **preview** (push the branch) and smoke-test (below).
4. Create the webhooks.
5. Merge to `main` (prod).

## Testing

Simulate a webhook against the deployed function (use real UUIDs from a pending
`team_members` row — the email goes to the project's owner/co-leads, not to
`user_id`):

```bash
curl -i https://<preview-url>/api/notify \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"type":"INSERT","table":"team_members","record":{"project_id":"<uuid>","user_id":"<uuid>","name":"Test Student","school":"NYU","role":"Engineer","status":"pending","message":"Hi!"}}'
```

Expect `{"sent":1,...}` and an email. A wrong/missing secret returns `401`; an
unhandled event returns `{"skipped":true}`. Check Resend → Logs and the Vercel
function logs if nothing arrives.

## Unsubscribe (prefetch-safe)

Every email's footer link and `List-Unsubscribe` header carry a tokenized URL
(`/api/unsubscribe?u=<id>&t=<hmac>`). The HMAC means a link only works for its
own recipient (and doubles as CSRF protection).

**GET is read-only.** It renders a confirmation page with an "Unsubscribe me"
button and changes nothing. This is deliberate: `.edu` mail systems aggressively
**pre-fetch** links with security scanners (Proofpoint, Microsoft Defender Safe
Links, Barracuda…), and a GET that mutated state would unsubscribe students who
never clicked. **POST** is the only thing that flips `profiles.email_opt_out` —
fired by that button or by a provider's RFC-8058 one-click "Unsubscribe"
(Gmail/Yahoo). Scanners only ever GET/HEAD, so they hit the harmless page.

`notify.js` checks the flag and skips opted-out recipients. The
"unsubscribed" page links back to a GET resubscribe confirmation (also
read-only) with its own POST button.
