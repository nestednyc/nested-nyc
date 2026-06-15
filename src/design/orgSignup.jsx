/* ============================================================
   NESTED NYC — Org sign-up / sign-in
   Separate auth path for organization accounts (universities, clubs,
   communities). No .edu requirement — orgs use any institutional
   address. Sign-up routes through a 6-digit email-confirmation code
   (same mechanism as student onboarding) into org onboarding; sign-in
   routes the org owner straight to their dashboard via NestedApp's
   auth branch.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Stamp, Pin, CodeBoxes } from './shared'
import { authService, isSupabaseConfigured, getErrorMessage } from '../lib/supabase'
import { lookupService } from '../services/lookupService'

  const { useState, useEffect } = React;

  function OrgSignup({ onBack, onSignedUp, onSignedIn, onForgot, onToast, initialMode, initialEmail }) {
    const [mode, setMode] = useState(initialMode || 'signup'); // 'signup' | 'signin'
    const [phase, setPhase] = useState('form'); // 'form' | 'code'
    const [email, setEmail] = useState(initialEmail || '');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [resendCooldown, setResendCooldown] = useState(0);
    // Bumped whenever a fresh code is issued; keys CodeBoxes so it remounts
    // and its autoFocus lands the cursor back in box 1 (matches the student
    // and forgot screens' focus-after-resend behavior).
    const [codeNonce, setCodeNonce] = useState(0);

    const emailValid = authService.validateEmailFormat(email.trim()).valid;
    // Composition rules apply to NEW passwords only. Sign-in must accept any
    // existing password (e.g. one provisioned before the uppercase rule).
    const passwordValid = mode === 'signup'
      ? password.length >= 6 && /[A-Z]/.test(password)
      : password.length > 0;
    const confirmValid = mode === 'signin' || (!!confirm && confirm === password);
    const canSubmit = emailValid && passwordValid && confirmValid && !submitting;
    const codeString = code.join('');
    const codeReady = codeString.length === 6;

    // Resend cooldown ticker (mirrors forgot.jsx / onboarding.jsx)
    useEffect(() => {
      if (resendCooldown <= 0) return;
      const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }, [resendCooldown]);

    function enterCodePhase() {
      setCode(["", "", "", "", "", ""]);
      setResendCooldown(30);
      setError('');
      setCodeNonce((n) => n + 1);
      setPhase('code');
    }

    async function submit() {
      if (!canSubmit) return;
      setError('');
      setSubmitting(true);

      if (!isSupabaseConfigured()) {
        setError('Supabase isn\'t configured in this environment — can\'t sign in yet.');
        setSubmitting(false);
        return;
      }

      if (mode === 'signup') {
        // Gate against an already-registered email BEFORE signUp: Supabase
        // obfuscates that case into a fake "confirmation sent" success, which
        // would strand the user on a code screen no email ever reaches.
        // Lookup errors soft-fail and continue (same as student onboarding).
        const { exists, error: lookupErr } = await lookupService.checkEmailExists(email.trim());
        if (!lookupErr && exists) {
          setMode('signin');
          setConfirm('');
          setError('This email is already registered — sign in instead.');
          setSubmitting(false);
          return;
        }

        const { data, error: signupErr } = await authService.signUpAsOrg(email.trim(), password);
        if (signupErr) {
          setError(getErrorMessage(signupErr));
          setSubmitting(false);
          return;
        }
        setSubmitting(false);
        if (data && data.needsEmailConfirmation) {
          enterCodePhase();
          return;
        }
        // Autoconfirm environments (local dev) skip straight through.
        onSignedUp && onSignedUp();
      } else {
        const { data, error: signinErr } = await authService.signInWithEmailPassword(email.trim(), password);
        if (signinErr) {
          // Signed up earlier but never confirmed: re-send a fresh code and
          // drop them into the code step instead of a "check your inbox for
          // a link" dead end. If the resend itself failed (rate limit /
          // network), surface that on the code screen — the previous code may
          // still be valid, so the entry boxes stay useful either way.
          if (signinErr.code === 'EMAIL_NOT_CONFIRMED') {
            const { error: rErr } = await authService.resendSignupOtp(email.trim());
            setSubmitting(false);
            enterCodePhase();
            if (rErr) setError(getErrorMessage(rErr));
            return;
          }
          setError(getErrorMessage(signinErr));
          setSubmitting(false);
          return;
        }
        onSignedIn && onSignedIn(data);
      }
    }

    async function verifyCode() {
      if (!codeReady || submitting) return;
      setSubmitting(true);
      setError('');
      const { error: vErr } = await authService.verifySignupOtp(email.trim(), codeString);
      if (vErr) {
        setError(getErrorMessage(vErr));
        setSubmitting(false);
        return;
      }
      // The account is confirmed and the session is live — on to org onboarding.
      setSubmitting(false);
      onSignedUp && onSignedUp();
    }

    async function resendCode() {
      if (resendCooldown > 0 || submitting) return;
      setCode(["", "", "", "", "", ""]);
      setError('');
      const { error: rErr } = await authService.resendSignupOtp(email.trim());
      if (rErr) {
        setError(getErrorMessage(rErr));
        return;
      }
      setResendCooldown(30);
      setCodeNonce((n) => n + 1); // remount CodeBoxes → autoFocus box 1
    }

    // Compact brand header + back link for phones, where the aside (which
    // carries both on desktop) is display:none. Inert above 880px.
    const mobHead = React.createElement(React.Fragment, null,
      React.createElement("div", { className: "onb-mobhead" },
        React.createElement("div", { className: "brand" },
          React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
          React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
        ),
        React.createElement("p", { className: "onb-mobpitch" }, "The shared events calendar for every NYC campus.")
      ),
      phase === 'form' && React.createElement("button", { className: "ghost-link onb-mobback", onClick: onBack },
        React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Back")
    );

    if (phase === 'code') {
      return (
        React.createElement("div", { className: "onb onb-signup" },
          React.createElement("div", { className: "onb-aside corkbg grain" },
            React.createElement("div", { className: "a-top" },
              React.createElement("div", { className: "brand" },
                React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
                React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
              ),
              React.createElement("button", { className: "ghost-link", onClick: onBack, style: { fontSize: 13 } },
                React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Back")
            ),
            React.createElement("div", { className: "onb-pitch" },
              React.createElement("h2", null, "Check your", React.createElement("br"), "inbox."),
              React.createElement("p", null, "We emailed a 6-digit code to " + email.trim() + ". Enter it here to finish setting up your organization on Nested.")
            )
          ),
          React.createElement("div", { className: "onb-main grain" },
            mobHead,
            React.createElement("div", { className: "onb-card create" },
              React.createElement(Pin, { className: "onb-card-pin" }),
              React.createElement("div", { className: "fade-up" },
                React.createElement("span", { className: "onb-kicker" }, "One more step"),
                React.createElement("h1", null, "Enter the code."),
                React.createElement("p", { className: "desc" }, "We emailed a 6-digit code to ", React.createElement("b", null, email.trim()), ". Check your inbox (and spam, just in case)."),
                React.createElement("div", { className: "field" },
                  React.createElement("label", null, "6-digit code"),
                  React.createElement(CodeBoxes, {
                    key: codeNonce,
                    value: code,
                    autoFocus: true,
                    onChange: (next) => { setCode(next); setError(''); },
                    onSubmit: verifyCode,
                  }),
                  error
                    ? React.createElement("div", { className: "hint err" }, "// " + error)
                    : React.createElement("div", { className: "hint" }, "// paste the full code if it's easier")
                ),
                React.createElement("div", { style: { marginTop: 14, fontFamily: "var(--mono)", fontSize: 12 } },
                  resendCooldown > 0
                    ? React.createElement("span", { style: { color: "var(--ink-faint)" } }, "// resend available in " + resendCooldown + "s")
                    : React.createElement("button", { className: "ghost-link", onClick: resendCode, disabled: submitting }, "Didn't get it? Resend the code →")
                )
              ),
              React.createElement("div", { className: "onb-actions" },
                React.createElement("button", { className: "ghost-link", onClick: () => { setPhase('form'); setError(''); }, disabled: submitting }, "← Back"),
                React.createElement("span", { className: "spacer" }),
                React.createElement("button", {
                  className: "btn btn-primary",
                  disabled: !codeReady || submitting,
                  style: (!codeReady || submitting) ? { opacity: 0.4, pointerEvents: "none" } : {},
                  onClick: verifyCode,
                },
                  submitting ? "Just a sec…" : "Verify & continue",
                  React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" }))
              )
            )
          )
        )
      );
    }

    return (
      React.createElement("div", { className: "onb onb-signup" },
        React.createElement("div", { className: "onb-aside corkbg grain" },
          React.createElement("div", { className: "a-top" },
            React.createElement("div", { className: "brand" },
              React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            ),
            React.createElement("button", { className: "ghost-link", onClick: onBack, style: { fontSize: 13 } },
              React.createElement(Icon, { name: "arrowLeft", size: 14 }), "Back to the board")
          ),
          React.createElement("div", { className: "onb-pitch" },
            React.createElement("h2", null, "For ", React.createElement("em", null, "orgs"), " on", React.createElement("br"), "campus."),
            React.createElement("p", null, "Universities, clubs and communities — Nested is the shared calendar for every NYC campus. Sign your org up, publish events, and reach students across schools."),
            React.createElement("div", { className: "onb-mini-board" },
              React.createElement("div", { style: { display: "grid", placeItems: "center", padding: "28px 0" } },
                React.createElement(Stamp, { size: 92, label: "ORG" })
              )
            )
          )
        ),
        React.createElement("div", { className: "onb-main grain" },
          mobHead,
          React.createElement("div", { className: "onb-card create" },
            React.createElement(Pin, { className: "onb-card-pin" }),
            React.createElement("div", { className: "fade-up" },
              React.createElement("span", { className: "onb-kicker" }, mode === 'signup' ? "New org" : "Returning org"),
              React.createElement("h1", null, mode === 'signup' ? "Sign your org up." : "Welcome back."),
              React.createElement("p", { className: "desc" }, mode === 'signup'
                ? "Use the email students should reply to — your org page, event invites and replies all run through it."
                : "Sign in with the email your org uses. You'll land on your dashboard."),

              React.createElement("div", { className: "field" },
                React.createElement("label", null, "Org email"),
                React.createElement("div", { className: "input-wrap" + (emailValid ? " good" : "") },
                  React.createElement(Icon, { name: "mail", size: 17 }),
                  React.createElement("input", {
                    type: "email",
                    placeholder: "events@yourorg.com",
                    value: email,
                    autoFocus: true,
                    onChange: (e) => setEmail(e.target.value),
                    onKeyDown: (e) => { if (e.key === "Enter" && canSubmit) submit(); },
                  })
                )
              ),

              React.createElement("div", { className: "field", style: { marginTop: 22 } },
                React.createElement("label", null, "Password"),
                React.createElement("div", { className: "input-wrap" + (passwordValid ? " good" : "") },
                  React.createElement(Icon, { name: "lock", size: 17 }),
                  React.createElement("input", {
                    type: "password",
                    placeholder: mode === 'signup' ? "At least 6 characters · 1 uppercase" : "Your password",
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    onKeyDown: (e) => { if (e.key === "Enter" && canSubmit) submit(); },
                  })
                ),
                mode === 'signin' && onForgot && React.createElement("div", { style: { marginTop: 10, fontFamily: "var(--mono)", fontSize: 12 } },
                  React.createElement("button", { className: "ghost-link", onClick: () => onForgot(email.trim()) }, "Forgot password? →")
                )
              ),

              mode === 'signup' && React.createElement("div", { className: "field", style: { marginTop: 22 } },
                React.createElement("label", null, "Confirm password"),
                React.createElement("div", { className: "input-wrap" + (confirmValid ? " good" : "") },
                  React.createElement(Icon, { name: "lock", size: 17 }),
                  React.createElement("input", {
                    type: "password",
                    placeholder: "Type it again",
                    value: confirm,
                    onChange: (e) => setConfirm(e.target.value),
                    onKeyDown: (e) => { if (e.key === "Enter" && canSubmit) submit(); },
                  })
                )
              ),

              error && React.createElement("div", { className: "hint", style: { marginTop: 14, color: "var(--c-startup)" } }, "// " + error),

              React.createElement("div", { className: "onb-actions" },
                React.createElement("button", { className: "ghost-link", onClick: () => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); } },
                  mode === 'signup' ? "← Already have an org account? Sign in" : "← Need an org account? Sign up"),
                React.createElement("span", { className: "spacer" }),
                React.createElement("button", {
                  className: "btn btn-primary",
                  disabled: !canSubmit,
                  style: !canSubmit ? { opacity: 0.4, pointerEvents: "none" } : {},
                  onClick: submit,
                },
                  React.createElement(Icon, { name: mode === 'signup' ? "pin" : "arrowRight", size: 17, stroke: "var(--paper)" }),
                  submitting ? (mode === 'signup' ? "Creating…" : "Signing in…") : (mode === 'signup' ? "Create org account" : "Sign in"))
              )
            )
          )
        )
      )
    );
  }

  export { OrgSignup };
  export default OrgSignup;
