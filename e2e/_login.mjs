/* ============================================================
   Shared e2e login — headless sign-in via the app's OWN client
   singleton (Vite serves /src/lib/supabase.js to the page), so the
   session lands in localStorage and the next page.goto boots
   already-authed. Used by authed-screenshots.mjs and
   org-auth-flows.mjs; the leading underscore marks it as a helper,
   not a runnable script.
   Returns 'OK' or 'ERR: <message>' — callers decide throw vs log.
   ============================================================ */
export async function headlessLogin(page, base, email, pass) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  return page.evaluate(async ({ email, pass }) => {
    const m = await import('/src/lib/supabase.js');
    const r = await m.authService.signInWithEmailPassword(email, pass);
    return r && r.error ? ('ERR: ' + (r.error.message || JSON.stringify(r.error))) : 'OK';
  }, { email, pass });
}
