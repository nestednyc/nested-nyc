/* ============================================================
   NESTED NYC — Forgot password (3 steps on one screen)
   email → 6-digit code → new password
   Code-based (not link-based) so email-scanner prefetch can't
   consume the single-use Supabase recovery token.
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { authService, isSupabaseConfigured, getErrorMessage } from '../lib/supabase'

  const { useState, useEffect, useRef } = React;

  const CODE_BOX_STYLE = {
    width: 46, height: 56, textAlign: "center",
    fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700,
    color: "var(--ink)", background: "var(--paper)",
    border: "1.5px solid var(--paper-edge)", borderRadius: 11,
    outline: "none", transition: "border-color .15s, box-shadow .15s",
  };

  function ForgotPassword({ initialEmail, onBack, onComplete }) {
    const [step, setStep] = useState("email"); // 'email' | 'code' | 'password'
    const [email, setEmail] = useState(initialEmail || "");
    const [emailTouched, setEmailTouched] = useState(false);
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);
    const codeRefs = useRef([]);

    // Format-only: this screen serves students AND org accounts (any domain).
    // The reset email only ever goes to an existing account, so the address
    // shape is the only thing worth gating client-side. Same validator the
    // service re-applies, so the button can't enable for an address the
    // service would reject.
    const emailValid = authService.validateEmailFormat(email.trim()).valid;
    const codeString = code.join("");
    const codeReady = codeString.length === 6;
    const passwordValid = password.length >= 6 && /[A-Z]/.test(password);
    const confirmValid = !!confirm && confirm === password;
    const canSubmitPassword = passwordValid && confirmValid;

    // Auto-submit once all six digits are present (typed or pasted). Ref guards
    // re-firing a rejected code / double-submitting while a verify is in flight.
    const autoVerifiedRef = useRef("");
    useEffect(() => {
      if (codeReady && !submitting && autoVerifiedRef.current !== codeString) {
        autoVerifiedRef.current = codeString;
        submitCode();
      }
    }, [codeReady, submitting, codeString]);

    // Resend cooldown ticker
    useEffect(() => {
      if (resendCooldown <= 0) return;
      const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }, [resendCooldown]);

    // Focus the first code box when arriving on the code step
    useEffect(() => {
      if (step === "code") setTimeout(() => codeRefs.current[0] && codeRefs.current[0].focus(), 50);
    }, [step]);

    async function sendCode() {
      if (!isSupabaseConfigured()) {
        setSubmitError("Password reset needs an internet connection.");
        return false;
      }
      setSubmitting(true);
      setSubmitError("");
      const { error } = await authService.sendPasswordReset(email.trim());
      setSubmitting(false);
      if (error) {
        setSubmitError(getErrorMessage(error));
        return false;
      }
      setResendCooldown(30);
      return true;
    }

    async function submitEmail() {
      if (!emailValid) { setEmailTouched(true); return; }
      const ok = await sendCode();
      if (ok) {
        setCode(["", "", "", "", "", ""]);
        setStep("code");
      }
    }

    async function submitCode() {
      if (!codeReady || submitting) return;
      setSubmitting(true);
      setSubmitError("");
      const { error } = await authService.verifyPasswordResetOtp(email.trim(), codeString);
      setSubmitting(false);
      if (error) {
        setSubmitError(getErrorMessage(error));
        return;
      }
      setStep("password");
    }

    async function submitPassword() {
      if (!canSubmitPassword) return;
      setSubmitting(true);
      setSubmitError("");
      const { error } = await authService.updatePassword(password);
      if (error) {
        setSubmitting(false);
        setSubmitError(getErrorMessage(error));
        return;
      }
      // Recovery session is now a real session — let NestedApp re-hydrate
      // and route the user (student → discover, org owner → orgDashboard).
      setSubmitting(false);
      onComplete && onComplete();
    }

    async function resend() {
      if (resendCooldown > 0 || submitting) return;
      setCode(["", "", "", "", "", ""]);
      setSubmitError("");
      await sendCode();
      setTimeout(() => codeRefs.current[0] && codeRefs.current[0].focus(), 50);
    }

    function setCodeDigit(i, raw) {
      const digit = (raw || "").replace(/\D/g, "").slice(0, 1);
      const next = code.slice();
      next[i] = digit;
      setCode(next);
      setSubmitError("");
      if (digit && i < 5) codeRefs.current[i + 1] && codeRefs.current[i + 1].focus();
    }
    function onCodeKeyDown(i, e) {
      if (e.key === "Backspace" && !code[i] && i > 0) {
        codeRefs.current[i - 1] && codeRefs.current[i - 1].focus();
      } else if (e.key === "Enter" && codeReady) {
        submitCode();
      }
    }
    function onCodePaste(e) {
      const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;
      e.preventDefault();
      const next = ["", "", "", "", "", ""];
      pasted.split("").forEach((d, i) => { if (i < 6) next[i] = d; });
      setCode(next);
      setSubmitError("");
      const firstEmpty = next.findIndex((c) => !c);
      const focusIdx = firstEmpty === -1 ? 5 : firstEmpty;
      codeRefs.current[focusIdx] && codeRefs.current[focusIdx].focus();
    }

    // ---------- step bodies ----------
    let body;

    if (step === "email") {
      const cls = !emailTouched || email === "" ? "" : emailValid ? "good" : "bad";
      body = (
        React.createElement("div", { className: "fade-up", key: "fp0" },
          React.createElement("span", { className: "onb-kicker" }, "Reset · Step 1"),
          React.createElement("h1", null, "Forgot password?"),
          React.createElement("p", { className: "desc" }, "Drop the email on your account and we'll send a 6-digit code. The code expires in a few minutes."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Email"),
            React.createElement("div", { className: "input-wrap " + cls },
              React.createElement(Icon, { name: "mail", size: 19 }),
              React.createElement("input", {
                type: "email", placeholder: "you@nyu.edu or events@yourorg.com", value: email, autoFocus: !initialEmail,
                onChange: (e) => { setEmail(e.target.value); setEmailTouched(true); setSubmitError(""); },
                onKeyDown: (e) => { if (e.key === "Enter" && emailValid && !submitting) submitEmail(); },
              })
            ),
            submitError
              ? React.createElement("div", { className: "hint err" }, "// " + submitError)
              : emailTouched && email && !emailValid
                ? React.createElement("div", { className: "hint err" }, "// that doesn't look like an email address")
                : React.createElement("div", { className: "hint" }, "// the same one you signed up with")
          )
        )
      );
    } else if (step === "code") {
      body = (
        React.createElement("div", { className: "fade-up", key: "fp1" },
          React.createElement("span", { className: "onb-kicker" }, "Reset · Step 2"),
          React.createElement("h1", null, "Enter the code."),
          React.createElement("p", { className: "desc" }, "We sent a 6-digit code to ", React.createElement("b", null, email), ". Check your inbox (and spam, just in case)."),
          React.createElement("p", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", margin: "-4px 0 14px", letterSpacing: "0.02em" } }, "// psst — it loves to hide in spam. peek there."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "6-digit code"),
            React.createElement("div", { style: { display: "flex", gap: 10 }, onPaste: onCodePaste },
              code.map((d, i) => (
                React.createElement("input", {
                  key: i,
                  ref: (el) => { codeRefs.current[i] = el; },
                  type: "text", inputMode: "numeric", maxLength: 1,
                  value: d, className: "code-box", style: CODE_BOX_STYLE,
                  onChange: (e) => setCodeDigit(i, e.target.value),
                  onKeyDown: (e) => onCodeKeyDown(i, e),
                })
              ))
            ),
            submitError
              ? React.createElement("div", { className: "hint err" }, "// " + submitError)
              : React.createElement("div", { className: "hint" }, "// paste the full code if it's easier")
          ),
          React.createElement("div", { style: { marginTop: 14, fontFamily: "var(--mono)", fontSize: 12 } },
            resendCooldown > 0
              ? React.createElement("span", { style: { color: "var(--ink-faint)" } }, "// resend available in " + resendCooldown + "s")
              : React.createElement("button", {
                  className: "ghost-link",
                  onClick: resend,
                  disabled: submitting,
                }, "Didn't get it? Resend the code →")
          )
        )
      );
    } else {
      body = (
        React.createElement("div", { className: "fade-up", key: "fp2" },
          React.createElement("span", { className: "onb-kicker" }, "Reset · Step 3"),
          React.createElement("h1", null, "Set a new password."),
          React.createElement("p", { className: "desc" }, "Pick something fresh. Six characters or more, with at least one uppercase letter."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "New password"),
            React.createElement("div", { className: "input-wrap" + (password ? (passwordValid ? " good" : " bad") : "") },
              React.createElement(Icon, { name: "link", size: 19 }),
              React.createElement("input", {
                type: "password", placeholder: "at least 6 characters, one capital",
                value: password, autoFocus: true, autoComplete: "new-password",
                onChange: (e) => setPassword(e.target.value),
              })
            ),
            password && !passwordValid
              ? React.createElement("div", { className: "hint err" }, "// 6+ chars · needs one uppercase letter")
              : passwordValid
                ? React.createElement("div", { className: "hint ok" }, "// strong enough")
                : React.createElement("div", { className: "hint" }, "// 6+ chars · needs one uppercase letter")
          ),
          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Confirm password"),
            React.createElement("div", { className: "input-wrap" + (confirm ? (confirmValid ? " good" : " bad") : "") },
              React.createElement(Icon, { name: "check", size: 19 }),
              React.createElement("input", {
                type: "password", placeholder: "type it again",
                value: confirm, autoComplete: "new-password",
                onChange: (e) => setConfirm(e.target.value),
                onKeyDown: (e) => { if (e.key === "Enter" && canSubmitPassword && !submitting) submitPassword(); },
              })
            ),
            submitError
              ? React.createElement("div", { className: "hint err" }, "// " + submitError)
              : confirm && !confirmValid
                ? React.createElement("div", { className: "hint err" }, "// these don't match yet")
                : React.createElement("div", { className: "hint" }, "// type it once more to be sure")
          )
        )
      );
    }

    // ---------- gating ----------
    const stepIndex = step === "email" ? 0 : step === "code" ? 1 : 2;
    const canPrimary = step === "email" ? (emailValid && !submitting)
      : step === "code" ? (codeReady && !submitting)
      : (canSubmitPassword && !submitting);
    const primaryLabel = (() => {
      if (submitting) return "Just a sec…";
      if (step === "email") return "Send code";
      if (step === "code") return "Verify code";
      return "Save new password";
    })();
    function handlePrimary() {
      if (step === "email") return submitEmail();
      if (step === "code") return submitCode();
      return submitPassword();
    }
    function handleBack() {
      if (step === "email") return onBack && onBack();
      if (step === "code") { setStep("email"); setSubmitError(""); return; }
      // password step intentionally has no back — recovery is single-use
    }

    return (
      React.createElement("div", { className: "onb" },
        React.createElement("div", { className: "onb-aside corkbg grain" },
          React.createElement("div", { className: "a-top" },
            React.createElement("div", { className: "brand" },
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            )
          ),
          React.createElement("div", { className: "onb-pitch" },
            React.createElement("h2", null, "Locked out?", React.createElement("br"), "We'll get you", React.createElement("br"), "back in.")
          )
        ),
        React.createElement("div", { className: "onb-main grain" },
          React.createElement("div", { className: "onb-card" },
            React.createElement("div", { className: "onb-steps" },
              Array.from({ length: 3 }).map((_, i) => (
                React.createElement("span", { key: i, className: "dot" + (i < stepIndex ? " done" : i === stepIndex ? " cur" : "") })
              ))
            ),
            body,
            React.createElement("div", { className: "onb-actions" },
              step !== "password" && React.createElement("button", {
                className: "ghost-link", onClick: handleBack, disabled: submitting,
              }, step === "email" ? "← Back to sign in" : "← Back"),
              React.createElement("span", { className: "spacer" }),
              React.createElement("button", {
                className: "btn btn-primary",
                disabled: !canPrimary,
                style: !canPrimary ? { opacity: 0.4, pointerEvents: "none" } : {},
                onClick: handlePrimary,
              },
                primaryLabel,
                React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" })
              )
            )
          )
        )
      )
    );
  }

  export { ForgotPassword };
  export default ForgotPassword;
