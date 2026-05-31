/* ============================================================
   NESTED NYC — Org sign-up / sign-in
   Separate auth path for organization accounts (universities, clubs,
   communities). No .edu requirement — orgs use any institutional
   address. Sign-up routes to org onboarding; sign-in routes the org
   owner straight to their dashboard via NestedApp's auth branch.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { Stamp, Pin } from './shared'
import { authService, isSupabaseConfigured, getErrorMessage } from '../lib/supabase'

  const { useState } = React;

  function OrgSignup({ onBack, onSignedUp, onSignedIn, onToast }) {
    const [mode, setMode] = useState('signup'); // 'signup' | 'signin'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [needsConfirm, setNeedsConfirm] = useState(false);

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const passwordValid = password.length >= 6 && /[A-Z]/.test(password);
    const confirmValid = mode === 'signin' || (!!confirm && confirm === password);
    const canSubmit = emailValid && passwordValid && confirmValid && !submitting;

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
        const { data, error: signupErr } = await authService.signUpAsOrg(email.trim(), password);
        if (signupErr) {
          setError(getErrorMessage(signupErr));
          setSubmitting(false);
          return;
        }
        if (data && data.needsEmailConfirmation) {
          setNeedsConfirm(true);
          setSubmitting(false);
          return;
        }
        onSignedUp && onSignedUp();
      } else {
        const { data, error: signinErr } = await authService.signInWithEmailPassword(email.trim(), password);
        if (signinErr) {
          setError(getErrorMessage(signinErr));
          setSubmitting(false);
          return;
        }
        onSignedIn && onSignedIn(data);
      }
    }

    if (needsConfirm) {
      return (
        React.createElement("div", { className: "onb" },
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
              React.createElement("p", null, "We sent a confirmation link to " + email.trim() + ". Open it to finish setting up your organization on Nested.")
            )
          ),
          React.createElement("div", { className: "onb-main grain" },
            React.createElement("div", { className: "onb-card create" },
              React.createElement("div", { className: "fade-up" },
                React.createElement("span", { className: "onb-kicker" }, "One more step"),
                React.createElement("h1", null, "Confirm your email."),
                React.createElement("p", { className: "desc" }, "Click the link in the message we just sent. After that, you'll come back here to finish onboarding your org."),
                React.createElement("div", { className: "onb-actions" },
                  React.createElement("button", { className: "ghost-link", onClick: onBack }, "← Back to sign in")
                )
              )
            )
          )
        )
      );
    }

    return (
      React.createElement("div", { className: "onb" },
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
          React.createElement("div", { className: "onb-card create" },
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
                  })
                )
              ),

              React.createElement("div", { className: "field", style: { marginTop: 22 } },
                React.createElement("label", null, "Password"),
                React.createElement("div", { className: "input-wrap" + (passwordValid ? " good" : "") },
                  React.createElement(Icon, { name: "lock", size: 17 }),
                  React.createElement("input", {
                    type: "password",
                    placeholder: "At least 6 characters · 1 uppercase",
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                  })
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
                  })
                )
              ),

              error && React.createElement("div", { className: "hint", style: { marginTop: 14, color: "var(--c-startup)" } }, "// " + error),

              React.createElement("div", { className: "onb-actions" },
                React.createElement("button", { className: "ghost-link", onClick: () => setMode(mode === 'signup' ? 'signin' : 'signup') },
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
