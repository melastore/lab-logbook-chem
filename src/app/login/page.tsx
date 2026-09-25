"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LabLogo } from "@/components/LabLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, RefreshCw, AlertTriangle, ShieldCheck,
  CheckCircle2, FileCheck2, ClipboardCheck,
} from "lucide-react";

// Only same-origin paths — anything else ("https://…", "//host") is a redirect
// out of the app and gets dropped.
function safeRedirect(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Second factor: shown only after a password check passes for a 2FA account.
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [capsLock, setCapsLock] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    if (!twoFactorRequired && (!username.trim() || !password)) {
      setMessage("Enter your username and password.");
      setSubmitting(false);
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          twoFactorRequired ? { username, password, twoFactorToken } : { username, password }
        ),
      });
    } catch {
      setMessage("Can't reach the server. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    const result = await response.json().catch(() => ({}));

    // Account has 2FA: switch to the code step (or report a bad code).
    if (result.twoFactorRequired) {
      setTwoFactorRequired(true);
      setMessage(response.ok ? "" : "Invalid authentication code.");
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      // Show the server's message (rate limit, archived account) when it has
      // one; fall back to the generic wording otherwise.
      const fallback = twoFactorRequired ? "Invalid authentication code." : "Invalid username or password.";
      setMessage(typeof result.error === "string" && result.error ? result.error : fallback);
      setSubmitting(false);
      return;
    }

    if (result.passwordChangeRequired) {
      router.push(`/change-password?redirect=${encodeURIComponent(redirectTo)}`);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  const reason = searchParams.get("reason");
  const banner = reason === "signed-out" ? "You've been signed out."
    : reason === "expired" ? "Your session ended. Sign in again to continue." : "";

  return (
    <main className="lg">
      <section className="lg-brand" aria-hidden="true">
        <div className="lg-brand-pattern" />
        <div className="lg-brand-top">
          <span className="lg-logo-tile"><LabLogo size={44} /></span>
          <span className="lg-org">Ethiopian Metrology Institute</span>
        </div>
        <div className="lg-brand-main">
          <p className="lg-kicker">Chemical Metrology Laboratory</p>
          <h1>Instrument logbook</h1>
          <p className="lg-lede">Record instrument use and sample preparation, all in one place.</p>
          <ul className="lg-points">
            <li><FileCheck2 size={18} /><span><strong>Signed records</strong> Every entry carries the analyst&apos;s signature.</span></li>
            <li><ShieldCheck size={18} /><span><strong>Tamper-evident</strong> Records are sealed and can&apos;t be silently changed.</span></li>
            <li><ClipboardCheck size={18} /><span><strong>Reviewed</strong> Admins approve, reject or comment on each record.</span></li>
          </ul>
        </div>
        <p className="lg-brand-foot">© {new Date().getFullYear()} Ethiopian Metrology Institute</p>
      </section>

      <section className="lg-panel">
        <div className="lg-panel-top">
          <span className="lg-mobile-brand"><LabLogo size={30} /><span>Lab Logbook</span></span>
          <ThemeToggle variant="chip" />
        </div>

        <div className="lg-card">
          {twoFactorRequired ? (
            <div className="lg-card-head">
              <span className="lg-step-icon"><ShieldCheck size={22} /></span>
              <h2>Two-step verification</h2>
              <p>Enter the 6-digit code from your authenticator app for <strong>{username}</strong>.</p>
            </div>
          ) : (
            <div className="lg-card-head">
              <h2>Sign in</h2>
              <p>Use the username and password your lab admin gave you.</p>
            </div>
          )}

          {banner && !message && (
            <div className="lg-banner" role="status"><CheckCircle2 size={16} /> <span>{banner}</span></div>
          )}

          <form className="lg-form" onSubmit={handleSubmit} noValidate>
            {!twoFactorRequired ? (
              <>
                <div className="lg-field">
                  <label htmlFor="username">Username</label>
                  <div className="lg-input">
                    <User size={18} aria-hidden="true" />
                    <input id="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
                      placeholder="e.g. analyst01" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
                  </div>
                </div>

                <div className="lg-field">
                  <label htmlFor="password">Password</label>
                  <div className="lg-input">
                    <Lock size={18} aria-hidden="true" />
                    <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password"
                      placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} required />
                    <button type="button" className="lg-input-btn" onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {capsLock && <span className="lg-warn"><AlertTriangle size={13} /> Caps Lock is on</span>}
                </div>
              </>
            ) : (
              <div className="lg-field">
                <label htmlFor="twoFactorToken">Authentication code</label>
                <input id="twoFactorToken" className="lg-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                  placeholder="000000" maxLength={6} value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, ""))} autoFocus required />
              </div>
            )}

            {message && (
              <div className="lg-error" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{message}</span>
              </div>
            )}

            <button className="lg-submit" type="submit"
              disabled={submitting || (twoFactorRequired ? twoFactorToken.length !== 6 : !username.trim() || !password)}>
              {submitting ? (
                <><RefreshCw className="spin" size={17} aria-hidden="true" /><span>{twoFactorRequired ? "Verifying…" : "Signing in…"}</span></>
              ) : (
                <><span>{twoFactorRequired ? "Verify and sign in" : "Sign in"}</span><ArrowRight size={17} /></>
              )}
            </button>

            {twoFactorRequired ? (
              <button type="button" className="lg-link" onClick={() => { setTwoFactorRequired(false); setTwoFactorToken(""); setMessage(""); }}>
                <ArrowLeft size={15} /> Use a different account
              </button>
            ) : (
              <p className="lg-help">Forgot your password? Ask your lab admin to reset it.</p>
            )}
          </form>
        </div>

        <p className="lg-secure"><Lock size={13} /> Secure connection · Access is logged</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="settings-loading-wrap" role="status" aria-live="polite">
        <RefreshCw className="spin auth-loading-icon" size={32} aria-hidden="true" />
        <p className="auth-loading-text">Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
