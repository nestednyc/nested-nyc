/* ============================================================
   NESTED NYC — Onboarding flow
   signup: email → password → username → uni+major → interests
   signin: email → password
   ============================================================ */
import React from 'react'
import Icon from './icons'
import { UNIVERSITIES, UNI, MAJORS, INTERESTS } from './data'
import { Stamp, Av, Pin } from './shared'
import { authService, isSupabaseConfigured, getErrorMessage } from '../lib/supabase'
import { lookupService } from '../services/lookupService'
import { profileService } from '../services/profileService'
import { toDbProfile, fromDbProfile } from './profileAdapter'

  const { useState, useRef, useEffect } = React;

  const SIGNUP_STEPS = 5;
  const SIGNIN_STEPS = 2;
  const UNIS_PER_TAB = 6;

  const CODE_BOX_STYLE = {
    width: 46, height: 56, textAlign: "center",
    fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700,
    color: "var(--ink)", background: "var(--paper)",
    border: "1.5px solid var(--paper-edge)", borderRadius: 11,
    outline: "none", transition: "border-color .15s, box-shadow .15s",
  };

  function detectUni(email) {
    const at = email.split("@")[1] || "";
    const u = UNIVERSITIES.find((x) => at.endsWith(x.domain));
    return u || null;
  }

  function UniSeal({ u }) {
    const [errored, setErrored] = useState(false);
    if (u.logo && !errored) {
      return React.createElement("span", {
        className: "seal",
        style: { background: "#fff", border: "1px solid var(--paper-edge)", overflow: "hidden", padding: 0 },
      },
        React.createElement("img", {
          src: u.logo, alt: u.name,
          style: { width: "84%", height: "84%", objectFit: "contain", display: "block" },
          onError: () => setErrored(true),
        })
      );
    }
    return React.createElement("span", {
      className: "seal", style: { background: u.color },
    }, u.name[0]);
  }

  function Onboarding({ onComplete, onOrgPath, onForgot, initialMode }) {
    const [mode, setMode] = useState(initialMode === "signin" ? "signin" : "signup"); // 'signup' | 'signin'
    const [step, setStep] = useState(0);
    const [email, setEmail] = useState("");
    const [emailTouched, setEmailTouched] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [checkingEmail, setCheckingEmail] = useState(false);

    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");

    const [username, setUsername] = useState("");
    const [usernameAvailable, setUsernameAvailable] = useState(null); // null | true | false
    const [usernameChecking, setUsernameChecking] = useState(false);

    const [uni, setUni] = useState(null);
    const [uniTab, setUniTab] = useState(0);
    const [major, setMajor] = useState("");
    const [interests, setInterests] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    // Signup email-confirmation code step. Shown after signup when the account
    // must confirm its .edu inbox (mailer_autoconfirm off) before the profile
    // can be created. Reuses the same 6-box code UX as the password-reset flow.
    const [awaitingCode, setAwaitingCode] = useState(false);
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [resendCooldown, setResendCooldown] = useState(0);
    const codeRefs = useRef([]);
    const codeString = code.join("");
    const codeReady = codeString.length === 6;

    // Resend cooldown ticker for the code step.
    useEffect(() => {
      if (resendCooldown <= 0) return;
      const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }, [resendCooldown]);

    const totalSteps = mode === "signup" ? SIGNUP_STEPS : SIGNIN_STEPS;

    const isEdu = /@[^@]+\.edu$/.test(email.trim());
    const detected = detectUni(email.trim());

    const passwordValid = password.length >= 6 && /[A-Z]/.test(password);
    const confirmValid = !!passwordConfirm && password === passwordConfirm;

    const usernameFmt = lookupService.validateUsernameFormat(username);
    const usernameOk = usernameFmt.valid && usernameAvailable !== false;

    function flipMode(newMode) {
      setMode(newMode);
      setStep(0);
      setSubmitError("");
      setEmailError("");
    }

    function next() {
      setStep((s) => Math.min(s + 1, totalSteps - 1));
      setEmailTouched(false);
      setSubmitError("");
    }
    function back() { setStep((s) => Math.max(s - 1, 0)); setSubmitError(""); }

    // when arriving at uni step (signup step 3), preselect detected
    useEffect(() => {
      if (mode === "signup" && step === 3 && detected && !uni) setUni(detected.id);
    }, [step, mode]);

    // jump to the tab containing the currently selected uni
    useEffect(() => {
      if (mode === "signup" && step === 3 && uni) {
        const idx = UNIVERSITIES.findIndex((u) => u.id === uni);
        if (idx >= 0) setUniTab(Math.floor(idx / UNIS_PER_TAB));
      }
    }, [step, uni, mode]);

    // Debounced username availability check (signup step 2)
    useEffect(() => {
      if (mode !== "signup" || step !== 2) return;
      if (!usernameFmt.valid) {
        setUsernameAvailable(null);
        return;
      }
      if (!isSupabaseConfigured()) {
        // local-only mode — accept any well-formed username
        setUsernameAvailable(true);
        return;
      }
      let cancelled = false;
      setUsernameChecking(true);
      const t = setTimeout(async () => {
        const { available } = await lookupService.checkUsernameAvailable(username.trim());
        if (cancelled) return;
        setUsernameAvailable(available);
        setUsernameChecking(false);
      }, 400);
      return () => { cancelled = true; clearTimeout(t); };
    }, [username, step, mode]);

    async function attemptNext() {
      // On signup step 0, gate against an already-registered email
      if (mode === "signup" && step === 0 && isEdu && isSupabaseConfigured()) {
        setCheckingEmail(true);
        const { exists, error } = await lookupService.checkEmailExists(email.trim());
        setCheckingEmail(false);
        if (error) {
          // Soft fail — don't block on a lookup error, just continue
        } else if (exists) {
          setEmailError("This email is already on Nested — sign in instead.");
          return;
        }
      }
      setEmailError("");
      next();
    }

    async function finishSignup() {
      if (submitting) return;
      setSubmitting(true);
      setSubmitError("");

      const localProfile = {
        username: username.trim(),
        uni: uni || (detected && detected.id) || "nyu",
        major: major || "Undeclared",
        fields: interests,
        email: email.trim(),
      };

      // Offline / no env — keep current local-only behavior
      if (!isSupabaseConfigured()) {
        setSubmitting(false);
        onComplete(localProfile);
        return;
      }

      // Try signup; if the account already exists, fall back to sign-in
      let signupRes = await authService.signUpWithEmailPassword(email.trim(), password);
      if (signupRes.error && /already|exists|registered/i.test(signupRes.error.message || "")) {
        signupRes = await authService.signInWithEmailPassword(email.trim(), password);
      }
      if (signupRes.error) {
        setSubmitError(getErrorMessage(signupRes.error));
        setSubmitting(false);
        return;
      }

      // Confirmation required: the account exists but has no session yet. Hold
      // the profile and collect the 6-digit code from the user's .edu inbox.
      if (signupRes.data && signupRes.data.needsEmailConfirmation) {
        setCode(["", "", "", "", "", ""]);
        setResendCooldown(30);
        setAwaitingCode(true);
        setSubmitting(false);
        return;
      }

      const userId = signupRes.data && signupRes.data.user && signupRes.data.user.id;
      if (!userId) {
        setSubmitError("Couldn't determine your account ID. Try signing in.");
        setSubmitting(false);
        return;
      }

      const payload = toDbProfile(localProfile, userId);
      const { data: row, error: upErr } = await profileService.upsertProfile(userId, payload);
      if (upErr) {
        setSubmitError(getErrorMessage(upErr));
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      onComplete(fromDbProfile(row, email.trim()));
    }

    // Verify the 6-digit signup code, then create the profile now that the
    // confirmed account has a real session.
    async function verifyCodeAndFinish() {
      if (!codeReady || submitting) return;
      setSubmitting(true);
      setSubmitError("");
      const { data: vData, error: vErr } = await authService.verifySignupOtp(email.trim(), codeString);
      if (vErr) { setSubmitError(getErrorMessage(vErr)); setSubmitting(false); return; }

      const userId = (vData && vData.user && vData.user.id)
        || (vData && vData.session && vData.session.user && vData.session.user.id);
      if (!userId) { setSubmitError("Couldn't confirm your account. Try the code again."); setSubmitting(false); return; }

      const localProfile = {
        username: username.trim(),
        uni: uni || (detected && detected.id) || "nyu",
        major: major || "Undeclared",
        fields: interests,
        email: email.trim(),
      };
      const { data: row, error: upErr } = await profileService.upsertProfile(userId, toDbProfile(localProfile, userId));
      if (upErr) { setSubmitError(getErrorMessage(upErr)); setSubmitting(false); return; }

      setSubmitting(false);
      onComplete(fromDbProfile(row, email.trim()));
    }

    async function resendSignupCode() {
      if (resendCooldown > 0 || submitting) return;
      setCode(["", "", "", "", "", ""]);
      setSubmitError("");
      const { error } = await authService.resendSignupOtp(email.trim());
      if (error) { setSubmitError(getErrorMessage(error)); return; }
      setResendCooldown(30);
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
        verifyCodeAndFinish();
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
      codeRefs.current[firstEmpty === -1 ? 5 : firstEmpty] && codeRefs.current[firstEmpty === -1 ? 5 : firstEmpty].focus();
    }

    async function finishSignin() {
      if (submitting) return;
      setSubmitting(true);
      setSubmitError("");

      if (!isSupabaseConfigured()) {
        setSubmitError("Sign-in needs an internet connection.");
        setSubmitting(false);
        return;
      }

      const { error: siErr } = await authService.signInWithEmailPassword(email.trim(), password);
      if (siErr) {
        setSubmitError(getErrorMessage(siErr));
        setSubmitting(false);
        return;
      }

      const { data: row, error: pfErr } = await profileService.getCurrentProfile();
      if (pfErr || !row) {
        setSubmitError("Signed in but couldn't load your profile. Try again.");
        setSubmitting(false);
        return;
      }

      setSubmitting(false);
      onComplete(fromDbProfile(row, email.trim()));
    }

    // ---------- step bodies ----------
    let body;

    if (mode === "signin") {
      if (step === 0) {
        const cls = !emailTouched || email === "" ? "" : isEdu ? "good" : "bad";
        body = (
          React.createElement("div", { className: "fade-up", key: "in0" },
            React.createElement("span", { className: "onb-kicker" }, "Sign in"),
            React.createElement("h1", null, "Welcome back."),
            React.createElement("p", { className: "desc" }, "Pick up where you left off. Drop your .edu email to sign back in."),
            React.createElement("div", { className: "field" },
              React.createElement("label", null, "University email"),
              React.createElement("div", { className: "input-wrap " + cls },
                React.createElement(Icon, { name: "user", size: 19 }),
                React.createElement("input", {
                  type: "email", placeholder: "you@nyu.edu", value: email, autoFocus: true,
                  onChange: (e) => { setEmail(e.target.value); setEmailTouched(true); setEmailError(""); },
                  onKeyDown: (e) => { if (e.key === "Enter" && isEdu) next(); },
                }),
                detected && React.createElement("span", { className: "suffix", style: { color: "var(--c-side)" } }, detected.name)
              ),
              emailTouched && email && !isEdu
                ? React.createElement("div", { className: "hint err" }, "// must be a .edu address")
                : React.createElement("div", { className: "hint" }, "// the same one you signed up with")
            ),
            React.createElement("div", { style: { marginTop: 14, fontFamily: "var(--mono)", fontSize: 12 } },
              React.createElement("button", { className: "ghost-link", onClick: () => flipMode("signup") }, "new here? Sign up →")
            )
          )
        );
      } else {
        body = (
          React.createElement("div", { className: "fade-up", key: "in1" },
            React.createElement("span", { className: "onb-kicker" }, "Sign in"),
            React.createElement("h1", null, "Enter your password."),
            React.createElement("p", { className: "desc" }, "Signing in as ", React.createElement("b", null, email), "."),
            React.createElement("div", { className: "field" },
              React.createElement("label", null, "Password"),
              React.createElement("div", { className: "input-wrap" + (password ? " good" : "") },
                React.createElement(Icon, { name: "link", size: 19 }),
                React.createElement("input", {
                  type: "password", placeholder: "your password", value: password, autoFocus: true,
                  onChange: (e) => setPassword(e.target.value),
                  onKeyDown: (e) => { if (e.key === "Enter" && password) finishSignin(); },
                })
              ),
              submitError
                ? React.createElement("div", { className: "hint err" }, "// " + submitError)
                : React.createElement("div", { className: "hint" }, "// 6+ chars · one uppercase")
            ),
            onForgot && React.createElement("div", { style: { marginTop: 14, fontFamily: "var(--mono)", fontSize: 12 } },
              React.createElement("button", {
                className: "ghost-link",
                onClick: () => onForgot(email.trim()),
                type: "button",
              }, "Forgot password? Reset it →")
            )
          )
        );
      }
    } else if (step === 0) {
      const cls = !emailTouched || email === "" ? "" : isEdu ? "good" : "bad";
      body = (
        React.createElement("div", { className: "fade-up", key: "s0" },
          React.createElement("span", { className: "onb-kicker" }, "Step 1 · The .edu gate"),
          React.createElement("h1", null, "Claim your spot."),
          React.createElement("p", { className: "desc" }, "Nested is students only. Drop your university email — we use the ", React.createElement("b", null, ".edu"), " to keep this a closed, peer-only space. No recruiters, no randoms."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "University email"),
            React.createElement("div", { className: "input-wrap " + cls },
              React.createElement(Icon, { name: "user", size: 19 }),
              React.createElement("input", {
                type: "email", placeholder: "you@nyu.edu", value: email, autoFocus: true,
                onChange: (e) => { setEmail(e.target.value); setEmailTouched(true); setEmailError(""); },
                onKeyDown: (e) => { if (e.key === "Enter" && isEdu && !checkingEmail) attemptNext(); },
              }),
              detected && React.createElement("span", { className: "suffix", style: { color: "var(--c-side)" } }, detected.name)
            ),
            emailError
              ? React.createElement("div", { className: "hint err" }, "// " + emailError)
              : emailTouched && email && !isEdu
                ? React.createElement("div", { className: "hint err" }, "// must be a .edu address")
                : detected
                  ? React.createElement("div", { className: "hint ok" }, "// recognized — " + detected.full)
                  : React.createElement("div", { className: "hint" }, "// NYU · Columbia · Cooper · Parsons · CUNY · Fordham …")
          ),
          React.createElement("div", { style: { marginTop: 14, fontFamily: "var(--mono)", fontSize: 12 } },
            React.createElement("button", { className: "ghost-link", onClick: () => flipMode("signin") }, "already on Nested? Sign in →")
          )
        )
      );
    } else if (step === 1) {
      body = (
        React.createElement("div", { className: "fade-up", key: "s1" },
          React.createElement("span", { className: "onb-kicker" }, "Step 2 · Lock it down"),
          React.createElement("h1", null, "Set a password."),
          React.createElement("p", { className: "desc" }, "Pick something memorable but secure. Six characters or more, with at least one uppercase letter."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Password"),
            React.createElement("div", { className: "input-wrap" + (password ? (passwordValid ? " good" : " bad") : "") },
              React.createElement(Icon, { name: "link", size: 19 }),
              React.createElement("input", {
                type: "password", placeholder: "at least 6 characters, one capital", value: password, autoFocus: true,
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
            React.createElement("div", { className: "input-wrap" + (passwordConfirm ? (confirmValid ? " good" : " bad") : "") },
              React.createElement(Icon, { name: "check", size: 19 }),
              React.createElement("input", {
                type: "password", placeholder: "type it again", value: passwordConfirm,
                onChange: (e) => setPasswordConfirm(e.target.value),
                onKeyDown: (e) => { if (e.key === "Enter" && passwordValid && confirmValid) next(); },
              })
            ),
            passwordConfirm && !confirmValid
              ? React.createElement("div", { className: "hint err" }, "// these don't match yet")
              : React.createElement("div", { className: "hint" }, "// type it once more to be sure")
          )
        )
      );
    } else if (step === 2) {
      body = (
        React.createElement("div", { className: "fade-up", key: "s2" },
          React.createElement("div", { className: "stamp-stage", style: { paddingBottom: 6 } },
            React.createElement(Stamp, { size: 120, className: "stamp-big", style: { width: 120, height: 120 } })
          ),
          React.createElement("span", { className: "onb-kicker" }, "Step 3 · Your handle"),
          React.createElement("h1", null, "Pick a username."),
          React.createElement("p", { className: "desc" }, "This is how teammates find and @ you. Letters, numbers, and underscores — must start with a letter."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Username"),
            React.createElement("div", { className: "input-wrap " + (username && (usernameOk && usernameAvailable !== false ? "good" : "bad")) },
              React.createElement("span", { className: "at" }, "@"),
              React.createElement("input", {
                placeholder: "mayabuilds", value: username, autoFocus: true,
                onChange: (e) => { setUsername(e.target.value.toLowerCase()); setUsernameAvailable(null); },
                onKeyDown: (e) => { if (e.key === "Enter" && usernameOk && usernameAvailable !== false && !usernameChecking) next(); },
              }),
              usernameOk && usernameAvailable === true && React.createElement(Icon, { name: "check", size: 18, stroke: "var(--c-side)" })
            ),
            !username
              ? React.createElement("div", { className: "hint" }, "// start with a letter · 3+ chars")
              : !usernameFmt.valid
                ? React.createElement("div", { className: "hint err" }, "// " + (usernameFmt.error || "invalid"))
                : usernameChecking
                  ? React.createElement("div", { className: "hint" }, "// checking availability…")
                  : usernameAvailable === false
                    ? React.createElement("div", { className: "hint err" }, "// @" + username.trim() + " is taken")
                    : usernameAvailable === true
                      ? React.createElement("div", { className: "hint ok" }, "// @" + username.trim() + " is available")
                      : React.createElement("div", { className: "hint" }, "// looking good")
          )
        )
      );
    } else if (step === 3) {
      body = (
        React.createElement("div", { className: "fade-up", key: "s3" },
          React.createElement("span", { className: "onb-kicker" }, "Step 4 · Where & what"),
          React.createElement("h1", null, "Where do you study?"),
          React.createElement("p", { className: "desc" }, "We pre-filled this from your email. Confirm your campus and add your major so projects can signal fit."),
          React.createElement("div", { className: "field" },
            React.createElement("label", null, "Campus"),
            React.createElement("div", { className: "uni-list" },
              UNIVERSITIES.slice(uniTab * UNIS_PER_TAB, (uniTab + 1) * UNIS_PER_TAB).map((u) => (
                React.createElement("button", {
                  key: u.id, className: "uni-opt" + (uni === u.id ? " on" : ""), onClick: () => setUni(u.id),
                },
                  React.createElement(UniSeal, { u }),
                  React.createElement("span", null,
                    React.createElement("b", null, u.name),
                    React.createElement("small", null, u.domain)
                  )
                )
              ))
            ),
            React.createElement("div", {
              style: {
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginTop: 12, fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-faint)",
              },
            },
              React.createElement("span", null, "// " + (uniTab + 1) + " of " + Math.ceil(UNIVERSITIES.length / UNIS_PER_TAB)),
              React.createElement("button", {
                className: "ghost-link",
                onClick: () => setUniTab((tab) => (tab + 1) % Math.ceil(UNIVERSITIES.length / UNIS_PER_TAB)),
              }, "More schools →")
            )
          ),
          React.createElement("div", { className: "field", style: { marginTop: 22 } },
            React.createElement("label", null, "Major"),
            React.createElement("div", { className: "chips-grid" },
              MAJORS.map((m) => (
                React.createElement("button", { key: m, className: "pick" + (major === m ? " on accent" : ""), onClick: () => setMajor(m) }, m)
              ))
            )
          )
        )
      );
    } else {
      body = (
        React.createElement("div", { className: "fade-up", key: "s4" },
          React.createElement("span", { className: "onb-kicker" }, "Step 5 · Interests"),
          React.createElement("h1", null, "What are you into?"),
          React.createElement("p", { className: "desc" }, "Pick a few — we'll surface projects that match. ", React.createElement("b", null, interests.length + " selected"), interests.length < 3 ? " · choose at least 3" : " · nice."),
          React.createElement("div", { className: "field" },
            React.createElement("div", { className: "chips-grid" },
              INTERESTS.map((it) => {
                const on = interests.includes(it);
                return React.createElement("button", {
                  key: it, className: "pick" + (on ? " on accent" : ""),
                  onClick: () => setInterests((arr) => on ? arr.filter((x) => x !== it) : [...arr, it]),
                },
                  on && React.createElement(Icon, { name: "check", size: 14, width: 2.4 }),
                  it
                );
              })
            ),
            submitError && React.createElement("div", { className: "hint err", style: { marginTop: 16 } }, "// " + submitError)
          )
        )
      );
    }

    // ---------- gating ----------
    const signupGates = [
      isEdu && !checkingEmail && !emailError,
      passwordValid && confirmValid,
      usernameOk && usernameAvailable !== false && !usernameChecking,
      !!uni && !!major,
      interests.length >= 3,
    ];
    const signinGates = [isEdu, password.length > 0];
    const canNext = mode === "signup" ? signupGates[step] : signinGates[step];

    const onLastStep = step === totalSteps - 1;
    const ctaDisabled = submitting || !canNext;
    const ctaStyle = ctaDisabled ? { opacity: 0.4, pointerEvents: "none" } : {};

    function handlePrimary() {
      if (mode === "signin") {
        if (onLastStep) return finishSignin();
        return next();
      }
      if (onLastStep) return finishSignup();
      if (step === 0) return attemptNext();
      return next();
    }

    const primaryLabel = (() => {
      if (submitting) return "Just a sec…";
      if (mode === "signin") return onLastStep ? "Sign in" : "Continue";
      if (onLastStep) return "Enter Nested";
      return "Continue";
    })();

    // Email-confirmation code screen — a terminal step shown only when signup
    // needs the .edu inbox confirmed. Mirrors the password-reset code UX.
    if (awaitingCode) {
      return (
        React.createElement("div", { className: "onb onb-signup" },
          React.createElement("div", { className: "onb-aside corkbg grain" },
            React.createElement("div", { className: "a-top" },
              React.createElement("div", { className: "brand" },
                React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
                React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
              )
            ),
            React.createElement("div", { className: "onb-pitch" },
              React.createElement("h2", null, "Check your", React.createElement("br"), "inbox.")
            )
          ),
          React.createElement("div", { className: "onb-main grain" },
            React.createElement("div", { className: "onb-mobhead" },
              React.createElement("div", { className: "brand" },
                React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
                React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
              ),
              React.createElement("p", { className: "onb-mobpitch" }, "Find your people for the thing you're building.")
            ),
            React.createElement("div", { className: "onb-card" },
              React.createElement(Pin, { className: "onb-card-pin" }),
              React.createElement("div", { className: "fade-up" },
                React.createElement("span", { className: "onb-kicker" }, "Last step · Confirm your .edu"),
                React.createElement("h1", null, "Enter the code."),
                React.createElement("p", { className: "desc" }, "We sent a 6-digit code to ", React.createElement("b", null, email.trim()), ". Check your inbox (and spam, just in case)."),
                React.createElement("p", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-faint)", margin: "-4px 0 14px", letterSpacing: "0.02em" } }, "// psst — it loves to hide in spam. peek there."),
                React.createElement("div", { className: "field" },
                  React.createElement("label", null, "6-digit code"),
                  React.createElement("div", { style: { display: "flex", gap: 10 }, onPaste: onCodePaste },
                    code.map((d, i) => (
                      React.createElement("input", {
                        key: i,
                        ref: (el) => { codeRefs.current[i] = el; },
                        type: "text", inputMode: "numeric", maxLength: 1, autoFocus: i === 0,
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
                    : React.createElement("button", { className: "ghost-link", onClick: resendSignupCode, disabled: submitting }, "Didn't get it? Resend the code →")
                )
              ),
              React.createElement("div", { className: "onb-actions" },
                React.createElement("button", { className: "ghost-link", onClick: () => { setAwaitingCode(false); setSubmitError(""); }, disabled: submitting }, "← Back"),
                React.createElement("span", { className: "spacer" }),
                React.createElement("button", {
                  className: "btn btn-primary",
                  disabled: !codeReady || submitting,
                  style: (!codeReady || submitting) ? { opacity: 0.4, pointerEvents: "none" } : {},
                  onClick: verifyCodeAndFinish,
                },
                  submitting ? "Just a sec…" : "Verify & enter Nested",
                  React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" })
                )
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
            )
          ),
          React.createElement("div", { className: "onb-pitch" },
            React.createElement("h2", null, "Find your people", React.createElement("br"), "for the thing", React.createElement("br"), "you're building."),
            React.createElement("p", null, "Startups, class projects, hackathon teams, research, side quests — the student-built layer for whatever you're making in NYC."),
            React.createElement("div", { className: "onb-mini-board" },
              React.createElement("div", { className: "mini-flyer", style: { transform: "rotate(-3deg)" } },
                React.createElement("div", { className: "cat-bar", style: { background: "var(--c-hack)" } }),
                React.createElement("b", null, "Subway Pulse"), React.createElement("small", null, "Cooper · hackathon")
              ),
              React.createElement("div", { className: "mini-flyer", style: { transform: "rotate(2.5deg)", marginTop: 14 } },
                React.createElement("div", { className: "cat-bar", style: { background: "var(--c-startup)" } }),
                React.createElement("b", null, "Loop"), React.createElement("small", null, "NYU · startup")
              )
            )
          ),
          onOrgPath && React.createElement("div", { className: "a-footer" },
            React.createElement("button", { className: "a-footer-link", onClick: onOrgPath, type: "button" },
              "Running a uni or club? ",
              React.createElement("span", null, "Org sign-up →")
            )
          )
        ),
        React.createElement("div", { className: "onb-main grain" },
          React.createElement("div", { className: "onb-mobhead" },
            React.createElement("div", { className: "brand" },
              React.createElement("span", { className: "mark" }, React.createElement(Icon, { name: "pin", size: 21, stroke: "var(--paper)" })),
              React.createElement("span", { className: "name" }, "Nested", React.createElement("span", null, "."))
            ),
            React.createElement("p", { className: "onb-mobpitch" }, "Find your people for the thing you're building.")
          ),
          React.createElement("div", { className: "onb-peek", "aria-hidden": true },
            React.createElement("div", { className: "mini-flyer" },
              React.createElement("div", { className: "cat-bar", style: { background: "var(--c-hack)" } }),
              React.createElement("b", null, "Subway Pulse"),
              React.createElement("small", null, "Cooper · hackathon")
            )
          ),
          React.createElement("div", { className: "onb-card" },
            React.createElement(Pin, { className: "onb-card-pin" }),
            React.createElement("div", { className: "onb-steps" },
              Array.from({ length: totalSteps }).map((_, i) => (
                React.createElement("span", { key: i, className: "dot" + (i < step ? " done" : i === step ? " cur" : "") })
              ))
            ),
            body,
            React.createElement("div", { className: "onb-actions" },
              step > 0 && React.createElement("button", { className: "ghost-link", onClick: back, disabled: submitting }, "← Back"),
              React.createElement("span", { className: "spacer" }),
              React.createElement("button", {
                className: "btn btn-primary",
                disabled: ctaDisabled, style: ctaStyle,
                onClick: handlePrimary,
              },
                primaryLabel,
                React.createElement(Icon, { name: "arrowRight", size: 17, stroke: "var(--paper)" })
              )
            )
          ),
          // Mobile-only org-path entry: the desktop link lives in the aside
          // footer above, and the aside is display:none under 880px — without
          // this, phones have no way into org sign-up at all.
          onOrgPath && React.createElement("button", { className: "onb-orgline", onClick: onOrgPath, type: "button" },
            "Running a uni or club? ",
            React.createElement("span", null, "Org sign-up →")
          )
        )
      )
    );
  }

  export { Onboarding };
  export default Onboarding;
