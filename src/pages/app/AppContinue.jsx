import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Mail, Eye, EyeOff, Check, ShieldAlert } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { safeStorage } from "../../utils/storage";
import { rememberMediaKey } from "../../lib/mediaKey";
import { storedReferral } from "../../lib/referralCapture";
import { postLoginPath } from "../auth/Login";
import useBusy from "../../lib/useBusy";
import ButtonSpinner from "../../components/common/ButtonSpinner";
import { OfflineSignInNotice } from "../../components/common/OfflineState"; // v334: offline → "Connect to the internet to sign in"
import { EMAIL_RE, randomPassword } from "../../lib/standalone";
import { openOAuth, oauthAppParams } from "../../lib/native";

// Session 42 (Ravi): one email box. The app finds out if the account exists:
//   exists, same role   → "Continue with OTP" (big) · "Use password instead" (small, below)
//   Session 48 (Ravi): if the account HAS a password → password box + "Log in with password" (big)
//   and "Log in with OTP instead" (small, below). Accounts without a password keep the OTP screen.
//   exists, other role  → offer that role, or another email
//   new email           → name + mobile (+ optional password) → email code → onboarding
// Every step uses existing server routes; only POST /auth/check-email and /auth/login-otp are new.
const ROLE_LABEL = { creator: "Creator", brand: "Brand / Agency" };
const RESEND_SECONDS = 30;

// Session 43 (Ravi): no icon chip (the sparkle looked AI-made) — one plain line that says which
// side you are on, so you know where you are.
const ROLE_LINE = { creator: "a Creator", brand: "a Brand / Agency" };
function Shell({ onBack, role, mode = "in", children }) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-[#F2F2F7] text-[#0A0A0A]"
      style={{ fontFamily: "'DM Sans', sans-serif", paddingTop: 8 /* Session 43: #root starts below the clock */, paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
    >
      <div className="relative flex items-center justify-center h-14 px-4">
        <button type="button" onClick={onBack} aria-label="Back" className="absolute left-3 w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5" data-testid="app-back">
          <ArrowLeft size={22} />
        </button>
        {/* v330: side padding so "signing up as a Brand / Agency" never runs under the back button on 320px */}
        <span className="text-[13px] text-[#6B7280] px-11 text-center leading-tight" data-testid="app-role-line">
          {mode === "up" ? "You're signing up as " : "You're signing in as "}
          <span className="font-semibold text-[#0A0A0A]">{ROLE_LINE[role] || ROLE_LINE.creator}</span>
        </span>
      </div>
      <div className="flex-1 flex flex-col px-6">{children}</div>
    </div>
  );
}

function Primary({ children, disabled, onClick, testId, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="w-full h-[54px] rounded-2xl bg-[#7C3AED] text-white text-[16px] font-semibold disabled:bg-[#E9E5F5] disabled:text-[#A39DB8] active:scale-[0.99] transition-[transform,background-color] flex items-center justify-center gap-2"
    >
      {children}
    </button>
  );
}

function CodeBoxes({ value, onChange, autoFocus = true, testId }) {
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 250); }, [autoFocus]);
  return (
    <label className="relative block mt-6" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit code"
        className="absolute inset-0 w-full h-full opacity-0"
        data-testid={testId}
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const active = i === Math.min(value.length, 5);
          return (
            <div
              key={i}
              className={`h-14 rounded-xl bg-white flex items-center justify-center text-[22px] font-bold border ${active ? "border-[#7C3AED] ring-4 ring-[#7C3AED]/10" : "border-[#E5E2EE]"}`}
            >
              {value[i] || ""}
            </div>
          );
        })}
      </div>
    </label>
  );
}

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(RESEND_SECONDS)];
}

const step = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.18 } },
};

/** iPhone / iPad (iPadOS reports a Mac with touch). Only these see "Continue with Apple". */
export function isIOSDevice(nav = typeof navigator !== "undefined" ? navigator : null) {
  if (!nav) return false;
  const ua = String(nav.userAgent || "");
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(nav.maxTouchPoints || 0) > 1);
}
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
function AppleMark() {
  return (
    <svg width="18" height="20" viewBox="0 0 814 1000" aria-hidden="true" fill="#fff">
      <path d="M788 341c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-58-156-128C44 790 0 669 0 554c0-185 120-283 239-283 63 0 115 41 155 41 38 0 97-44 169-44 27 0 125 2 190 73zM554 168c30-35 51-84 51-133 0-7-1-14-2-19-48 2-106 32-140 72-27 31-53 80-53 130 0 8 1 15 2 18 3 1 9 1 14 1 43 0 97-29 128-69z"/>
    </svg>
  );
}

export default function AppContinue() {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const { user, loading, login, signup, setUser } = useAuth();
  const { isBusy, anyBusy, run } = useBusy();

  const [role, setRole] = useState(roleParam === "brand" ? "brand" : "creator");
  const [stage, setStage] = useState("email"); // email | account | otp | password | mismatch | admin | signup | verify
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState(null); // answer of /auth/check-email
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // v291 (Ravi): every new account sets a password as well as the email code — people kept signing in
  // with codes only and never made one. The password box is always shown and required.
  const ownPassword = true;
  const [newPassword, setNewPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [resendLeft, startResend] = useCountdown();
  const emailRef = useRef(null);

  const cleanEmail = email.trim().toLowerCase();
  const emailOk = EMAIL_RE.test(cleanEmail);

  // Already logged in (e.g. back button after login): leave the auth screens.
  useEffect(() => {
    if (!loading && user) navigate(postLoginPath(user), { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => { setError(""); }, [stage]);
  useEffect(() => { if (stage === "email") setTimeout(() => emailRef.current?.focus(), 300); }, [stage]);

  const back = () => {
    if (stage === "email") return navigate("/app", { replace: true });
    // Session 48: password is the first screen for accounts that have one, so back goes to the email box.
    if (stage === "password") { setPassword(""); return setStage("email"); }
    if (stage === "otp") return setStage(account?.has_password ? "password" : "account");
    if (stage === "verify") return setStage("signup");
    setCode(""); setPassword("");
    setStage("email");
  };

  const finishLogin = (data) => {
    safeStorage.setItem("ybex_token", data.token);
    try { if (cleanEmail) window.localStorage.setItem("ybex_last_email", cleanEmail.toLowerCase()); } catch { /* private mode */ }
    safeStorage.setItem("ybex_user", JSON.stringify(data.user));
    try { rememberMediaKey(data); } catch { /* older answer without media key */ }
    setUser(data.user);
    navigate(postLoginPath(data.user), { replace: true });
  };

  const accountStatusError = (err) => {
    const d = err?.response?.data || {};
    if (["ACCOUNT_DELETED", "ACCOUNT_BANNED", "ACCOUNT_SUSPENDED"].includes(d.code)) {
      navigate("/account-status", { state: { status: d.code, message: d.detail, user_id: d.user_id, role: d.role } });
      return true;
    }
    return false;
  };

  // 1. Email → does the account exist?
  const checkEmail = () => run("check", async () => {
    if (!emailOk) { setError("Please enter a valid email address."); return; }
    try {
      const { data } = await api.post("auth/check-email", { email: cleanEmail });
      setAccount(data);
      if (!data?.exists) { setStage("signup"); return; }
      if (data.role === "admin") { setStage("admin"); return; }
      if (data.role && data.role !== role) { setStage("mismatch"); return; }
      setStage(data.has_password ? "password" : "account");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not check this email. Please try again.");
    }
  });

  // 2a. Send the login code.
  const sendLoginCode = () => run("send", async () => {
    try {
      const { data } = await api.post("auth/login-otp", { email: cleanEmail, app_role: role });
      setCode(data?.otp || ""); // test mode only: the server returns the code
      startResend();
      setStage("otp");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not send the code. Please try again.");
    }
  });

  // 2b. Check the login code.
  const verifyLoginCode = (value = code) => run("verify", async () => {
    if (value.length !== 6) return;
    try {
      const { data } = await api.post("auth/login", { email: cleanEmail, otp: value, app_role: role });
      if (data?.token) finishLogin(data);
      else setError("Could not log in. Please try again.");
    } catch (err) {
      if (accountStatusError(err)) return;
      if (err?.response?.data?.code === "ADMIN_ACCOUNT") { setStage("admin"); return; }
      setCode("");
      setError(err?.response?.data?.detail || "That code did not work. Please try again.");
    }
  });

  // 2c. Password instead.
  const passwordLogin = () => run("password", async () => {
    try {
      const u = await login(cleanEmail, password, role);
      if (u?.requiresVerification) { setStage("signup"); return; }
      navigate(postLoginPath(u), { replace: true });
    } catch (err) {
      if (accountStatusError(err)) return;
      if (err?.response?.data?.code === "ADMIN_ACCOUNT") { setStage("admin"); return; }
      setError(err?.response?.data?.detail || "Wrong email or password.");
    }
  });

  // 3. New account.
  const createAccount = () => run("signup", async () => {
    const fullName = name.trim();
    let mobile = phone.replace(/\D/g, "");
    if (mobile.length === 12 && mobile.startsWith("91")) mobile = mobile.slice(2);
    // v286 (Ravi): a brand is asked for the PERSON's name here (it becomes "Representative name");
    // the brand / company name is asked on the next onboarding step.
    if (!fullName) { setError("Please enter your name."); return; }
    if (!/^[6-9]\d{9}$/.test(mobile)) { setError("Please enter a valid 10-digit mobile number."); return; }
    if (ownPassword && newPassword.length < 8) { setError("Password needs at least 8 characters."); return; }
    if (!agree) { setError("Please confirm you are 18+ and agree to the Terms and Privacy Policy."); return; }
    try {
      const res = await signup(fullName, cleanEmail, ownPassword ? newPassword : randomPassword(), role, `+91${mobile}`, storedReferral() || "");
      if (res?.requiresVerification) {
        setCode(res.otp || "");
        startResend();
        setStage("verify");
      } else if (res) {
        navigate(`/onboarding?role=${role}`, { replace: true });
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create the account. Please try again.");
    }
  });

  const verifySignupCode = (value = code) => run("verify", async () => {
    if (value.length !== 6) return;
    try {
      const { data } = await api.post("auth/verify-email", { email: cleanEmail, otp: value });
      if (data?.token && data?.user) {
        safeStorage.setItem("ybex_token", data.token);
        try { if (cleanEmail) window.localStorage.setItem("ybex_last_email", cleanEmail.toLowerCase()); } catch { /* private mode */ }
        safeStorage.setItem("ybex_user", JSON.stringify(data.user));
        try { rememberMediaKey(data); } catch { /* fine */ }
        setUser(data.user);
        navigate(postLoginPath(data.user) === "/dashboard" ? "/dashboard" : `/onboarding?role=${role}`, { replace: true });
      } else {
        setError("Could not verify. Please try again.");
      }
    } catch (err) {
      setCode("");
      setError(err?.response?.data?.detail || "That code did not work. Please try again.");
    }
  });

  const resend = (kind) => run("resend", async () => {
    try {
      if (kind === "login") {
        const { data } = await api.post("auth/login-otp", { email: cleanEmail, app_role: role });
        if (data?.otp) setCode(data.otp);
      } else {
        const { data } = await api.post("auth/resend-verification-otp", { email: cleanEmail });
        if (data?.otp) setCode(data.otp);
      }
      startResend();
      toast.success("New code sent");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not send a new code.");
    }
  });

  const otherRole = useMemo(() => (account?.role === "brand" ? "brand" : "creator"), [account]);

  const ErrorLine = error ? <p className="mt-3 text-[13px] text-[#DC2626]" role="alert" data-testid="app-error">{error}</p> : null;
  const Terms = (
    <p className="mt-auto pt-8 text-center text-[12px] leading-relaxed text-[#8A8799]">
      {/* v334: Google / Apple sign-up skips the 18+ checkbox, so the line says it (Terms: 18+ only) */}
      By continuing you confirm you are 18 or older and accept the <a href="/info/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</a> and{" "}
      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.
    </p>
  );
  // v286: Google / Apple — same window (pop-ups don't come back inside the installed app).
  const showApple = isIOSDevice();
  const startOAuth = (provider) => run(provider, async () => {
    try {
      // v291 (Ravi: iPhone asks to type the Google ID, no suggestions): the installed iPhone app has no
      // Google cookies, so Google can't list accounts. Hand it the email — the one typed above, else the
      // last one used here — and Google opens straight on that account.
      let hint = "";
      if (provider === "google") {
        const typed = String(email || "").trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) hint = typed;
        else { try { hint = String(window.localStorage.getItem("ybex_last_email") || ""); } catch { hint = ""; } }
      }
      const { data } = await api.get("auth/oauth/url", { params: { provider, role, ...(hint ? { hint } : {}), ...oauthAppParams() }, bypassCache: true });
      if (data?.url) { await openOAuth(data.url); return; } // v335: phone browser sheet inside the iPhone app
      setError("Could not open sign-in. Please use your email.");
    } catch (e) {
      setError(e?.response?.data?.error || "Could not open sign-in. Please use your email.");
    }
  });
  const EmailChip = (
    <button type="button" onClick={() => setStage("email")} className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-[#6B7280] max-w-full min-h-[36px] self-start">
      {/* v330: long emails truncate instead of pushing "Change" off screen */}
      <Mail size={14} className="shrink-0" /> <span className="font-medium text-[#0A0A0A] truncate min-w-0">{cleanEmail}</span> <span className="text-[#7C3AED] font-semibold shrink-0">Change</span>
    </button>
  );

  return (
    <Shell onBack={back} role={role} mode={stage === "signup" || stage === "verify" ? "up" : "in"}>
      <AnimatePresence mode="wait">
        {stage === "email" && (
          <motion.form key="email" {...step} className="flex-1 flex flex-col" onSubmit={(e) => { e.preventDefault(); checkEmail(); }}>
            <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">What's your email?</h1>
            <p className="mt-2 text-[15px] text-[#6B7280]">We'll log you in, or make a new account if you're new here.</p>
            <OfflineSignInNotice className="mt-5" />{/* v334 */}
            <input
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-7 w-full h-[56px] rounded-2xl bg-white border border-[#E5E2EE] px-4 text-[17px] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
              data-testid="app-email"
            />
            {ErrorLine}
            <div className="mt-5">
              <Primary type="submit" disabled={!emailOk || anyBusy} testId="app-email-continue">
                {isBusy("check") ? <ButtonSpinner /> : "Continue"}
              </Primary>
            </div>
            {/* v286 (Ravi): iPhone → Google + Apple, Android → Google, under the e-mail option. */}
            <div className="mt-5 flex items-center gap-3 text-[12.5px] text-[#9CA3AF]" aria-hidden="true">
              <span className="flex-1 h-px bg-[#E5E2EE]" /> or <span className="flex-1 h-px bg-[#E5E2EE]" />
            </div>
            <div className="mt-4 space-y-3">
              <button type="button" onClick={() => startOAuth("google")} disabled={anyBusy} data-testid="app-oauth-google"
                className="w-full h-[54px] rounded-2xl bg-white border border-[#E5E2EE] flex items-center justify-center gap-2.5 text-[16px] font-semibold text-[#0A0A0A] active:scale-[0.99] transition-transform disabled:opacity-60">
                {isBusy("google") ? <ButtonSpinner /> : (<><GoogleMark /> Continue with Google</>)}
              </button>
              {showApple && !emailOk && (
                <p className="text-center text-[12.5px] leading-snug text-[#8A8799]" data-testid="app-google-tip">
                  Tip: type your Gmail in the box above first — Google then opens straight on it, no typing again.
                </p>
              )}
              {showApple && (
                <button type="button" onClick={() => startOAuth("apple")} disabled={anyBusy} data-testid="app-oauth-apple"
                  className="w-full h-[54px] rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center gap-2.5 text-[16px] font-semibold active:scale-[0.99] transition-transform disabled:opacity-60">
                  {isBusy("apple") ? <ButtonSpinner /> : (<><AppleMark /> Continue with Apple</>)}
                </button>
              )}
            </div>
            {Terms}
          </motion.form>
        )}

        {stage === "account" && (
          <motion.div key="account" {...step} className="flex-1 flex flex-col">
            <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">Welcome back</h1>
            {EmailChip}
            <p className="mt-5 text-[15px] text-[#6B7280]">We'll email you a 6-digit code to log in.</p>
            {ErrorLine}
            <div className="mt-6">
              <Primary onClick={sendLoginCode} disabled={anyBusy} testId="app-continue-otp">
                {isBusy("send") ? <ButtonSpinner /> : "Continue with OTP"}
              </Primary>
            </div>
            {account?.has_password && (
              <button type="button" onClick={() => setStage("password")} className="mt-5 text-[14px] font-semibold text-[#7C3AED] self-center min-h-[40px] px-2" /* v332: 40px tap area */ data-testid="app-use-password">
                Use password instead
              </button>
            )}
          </motion.div>
        )}

        {stage === "otp" && (
          <motion.div key="otp" {...step} className="flex-1 flex flex-col">
            <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">Enter the code</h1>
            <p className="mt-2 text-[15px] text-[#6B7280]">Sent to <span className="font-medium text-[#0A0A0A] break-all">{cleanEmail}</span>. Check spam if you don't see it.</p>
            <CodeBoxes value={code} onChange={(v) => { setCode(v); if (v.length === 6) verifyLoginCode(v); }} testId="app-login-code" />
            {ErrorLine}
            <div className="mt-6">
              <Primary onClick={() => verifyLoginCode()} disabled={code.length !== 6 || anyBusy} testId="app-login-verify">
                {isBusy("verify") ? <ButtonSpinner /> : "Log in"}
              </Primary>
            </div>
            <div className="mt-5 flex items-center justify-between text-[14px]">
              <button type="button" disabled={resendLeft > 0 || anyBusy} onClick={() => resend("login")} className="font-semibold text-[#7C3AED] disabled:text-[#A39DB8]">
                {resendLeft > 0 ? `Resend code in ${resendLeft}s` : "Resend code"}
              </button>
              {account?.has_password && (
                <button type="button" onClick={() => setStage("password")} className="font-semibold text-[#6B7280]">Use password instead</button>
              )}
            </div>
          </motion.div>
        )}

        {stage === "password" && (
          <motion.form key="password" {...step} className="flex-1 flex flex-col" onSubmit={(e) => { e.preventDefault(); passwordLogin(); }}>
            <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">Welcome back</h1>
            {EmailChip}
            <p className="mt-5 text-[15px] text-[#6B7280]">Enter your password to log in.</p>
            <div className="relative mt-6">
              <input
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[56px] rounded-2xl bg-white border border-[#E5E2EE] pl-4 pr-12 text-[17px] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                placeholder="Password"
                autoFocus
                data-testid="app-password"
              />
              <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#6B7280]" aria-label={showPass ? "Hide password" : "Show password"}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {ErrorLine}
            <div className="mt-5">
              <Primary type="submit" disabled={!password || anyBusy} testId="app-password-login">
                {isBusy("password") ? <ButtonSpinner /> : "Log in with password"}
              </Primary>
            </div>
            <button type="button" onClick={sendLoginCode} disabled={anyBusy} className="mt-5 text-[14px] font-semibold text-[#7C3AED] self-center min-h-[40px] px-2" /* v332 */ data-testid="app-use-otp">
              {isBusy("send") ? <ButtonSpinner /> : "Log in with OTP instead"}
            </button>
            <button type="button" onClick={() => navigate(`/forgot-password?email=${encodeURIComponent(cleanEmail)}`)} className="mt-1 text-[13px] font-semibold text-[#6B7280] self-center min-h-[40px] px-2">Forgot password?</button>{/* v332: 40px tap area */}
          </motion.form>
        )}

        {stage === "admin" && (
          <motion.div key="admin" {...step} className="flex-1 flex flex-col" data-testid="app-admin-email">
            <div className="mt-6 w-12 h-12 rounded-2xl bg-[#FEF3C7] text-[#B45309] flex items-center justify-center"><ShieldAlert size={22} /></div>
            <h1 className="mt-4 text-[26px] font-bold tracking-[-0.02em] leading-tight">This is a Ybex admin account</h1>
            <p className="mt-2 text-[15px] text-[#6B7280] break-words">{cleanEmail} belongs to the Ybex team. It can't be used as {ROLE_LINE[role] || ROLE_LINE.creator}.</p>
            <div className="mt-8"><Primary onClick={() => { setStage("email"); setTimeout(() => emailRef.current?.select?.(), 320); }} testId="app-admin-other">Use another email</Primary></div>
            <button type="button" onClick={() => navigate("/ybx-admin")} className="mt-4 text-[14px] font-semibold text-[#7C3AED]" data-testid="app-admin-open">Open admin panel</button>
          </motion.div>
        )}

        {stage === "mismatch" && (
          <motion.div key="mismatch" {...step} className="flex-1 flex flex-col">
            <h1 className="mt-6 text-[26px] font-bold tracking-[-0.02em] leading-tight">
              This email is a {ROLE_LABEL[otherRole]} account
            </h1>
            {EmailChip}
            <p className="mt-4 text-[15px] text-[#6B7280]">
              One email is one account. Log in as {otherRole === "brand" ? "a brand" : "a creator"}, or use a different email for a {ROLE_LABEL[role].toLowerCase()} account.
            </p>
            <div className="mt-7">
              <Primary onClick={() => { setRole(otherRole); navigate(`/app/continue/${otherRole}`, { replace: true }); setStage(account?.has_password ? "password" : "account"); }} testId="app-switch-role">
                Continue as {ROLE_LABEL[otherRole]}
              </Primary>
            </div>
            <button type="button" onClick={() => { setEmail(""); setStage("email"); }} className="mt-5 text-[14px] font-semibold text-[#7C3AED] self-center">
              Use another email
            </button>
          </motion.div>
        )}

        {stage === "signup" && (
          <motion.form key="signup" {...step} className="flex-1 flex flex-col" onSubmit={(e) => { e.preventDefault(); createAccount(); }}>
            <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">Create your account</h1>
            {EmailChip}
            <div className="mt-6 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Your full name"
                className="w-full h-[56px] rounded-2xl bg-white border border-[#E5E2EE] px-4 text-[17px] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                data-testid="app-signup-name"
              />
              <div className="flex items-center h-[56px] rounded-2xl bg-white border border-[#E5E2EE] focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-[#7C3AED]/10">
                <span className="pl-4 pr-2 text-[17px] text-[#6B7280]">+91</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="Mobile number"
                  className="flex-1 h-full bg-transparent pr-4 text-[17px] outline-none"
                  data-testid="app-signup-phone"
                />
              </div>
              {ownPassword ? (
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Create a password (8+ characters)"
                  className="w-full h-[56px] rounded-2xl bg-white border border-[#E5E2EE] px-4 text-[17px] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
                  data-testid="app-signup-password"
                />
              ) : null}
            </div>
            <label className="mt-4 flex items-start gap-3 text-[13px] leading-snug text-[#4B4760] cursor-pointer select-none">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="sr-only" data-testid="app-signup-agree" />
              <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${agree ? "bg-[#7C3AED] border-[#7C3AED] text-white" : "bg-white border-[#CFCBDD]"}`}>
                {agree && <Check size={14} strokeWidth={3} />}
              </span>
              <span>
                I am 18 or older and agree to the <a href="/info/terms" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] font-semibold">Terms</a> and{" "}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] font-semibold">Privacy Policy</a>, including emails about campaigns, my account and Ybex updates.
              </span>
            </label>
            {ErrorLine}
            <div className="mt-5">
              <Primary type="submit" disabled={anyBusy} testId="app-signup-continue">
                {isBusy("signup") ? <ButtonSpinner /> : "Continue with OTP"}
              </Primary>
            </div>
            <p className="mt-4 text-center text-[12.5px] leading-snug text-[#8A8799]">We'll still email you a code to verify this address. The password lets you log in any time.</p>
          </motion.form>
        )}

        {stage === "verify" && (
          <motion.div key="verify" {...step} className="flex-1 flex flex-col">
            <h1 className="mt-6 text-[28px] font-bold tracking-[-0.02em] leading-tight">Verify your email</h1>
            <p className="mt-2 text-[15px] text-[#6B7280]">We sent a 6-digit code to <span className="font-medium text-[#0A0A0A] break-all">{cleanEmail}</span>.</p>
            <CodeBoxes value={code} onChange={(v) => { setCode(v); if (v.length === 6) verifySignupCode(v); }} testId="app-verify-code" />
            {ErrorLine}
            <div className="mt-6">
              <Primary onClick={() => verifySignupCode()} disabled={code.length !== 6 || anyBusy} testId="app-verify-continue">
                {isBusy("verify") ? <ButtonSpinner /> : "Verify and continue"}
              </Primary>
            </div>
            <button type="button" disabled={resendLeft > 0 || anyBusy} onClick={() => resend("signup")} className="mt-5 text-[14px] font-semibold text-[#7C3AED] disabled:text-[#A39DB8] self-center">
              {resendLeft > 0 ? `Resend code in ${resendLeft}s` : "Resend code"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
