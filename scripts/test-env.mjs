// Preloaded into every `npm test` process (node --import; the test runner
// passes it on to each test file's child process).
//
// The unit tests also run inside the Vercel build (vercel.json buildCommand),
// where the real service-role / Resend / webhook secrets sit in the
// environment and every api/ module builds its clients at import time. Scrub
// those names first, so a test can only reach a backend it configured
// itself — see api/_tests/*.test.js, which set their own fake env before
// importing. api/_tests/test-env.test.js checks this file actually ran.
for (const k of Object.keys(process.env)) {
  if (/^(SUPABASE_|VITE_SUPABASE_|RESEND_|EMAIL_|WEBHOOK_SECRET$|UNSUBSCRIBE_SECRET$|CRON_SECRET$|APP_URL$|REPORT_RECIPIENTS$|ADMIN_RECIPIENTS$)/.test(k)) {
    delete process.env[k];
  }
}
process.env.NESTED_TEST_ENV_SCRUBBED = '1';
