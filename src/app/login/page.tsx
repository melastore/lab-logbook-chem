"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LabLogo } from "@/components/LabLogo";
import {
  User, Lock, Eye, EyeOff, ArrowRight, Shield, RefreshCw, AlertTriangle, ShieldCheck
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Second factor: shown only after a password check passes for a 2FA account.
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        twoFactorRequired ? { username, password, twoFactorToken } : { username, password }
      ),
    });

    const result = await response.json().catch(() => ({}));

    // Account has 2FA: switch to the code step (or report a bad code).
    if (result.twoFactorRequired) {
      setTwoFactorRequired(true);
      setMessage(response.ok ? "" : "Invalid authentication code.");
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      setMessage(twoFactorRequired ? "Invalid authentication code." : "Invalid username or password.");
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

  return (
    <main className="auth-split-layout">
      {/* ── Left Visual Panel (Visible on Desktop) ── */}
      <div className="auth-visual-side">
        <div className="auth-visual-grid" />
        <div className="auth-visual-blobs">
          <div className="auth-visual-blob-1" />
          <div className="auth-visual-blob-2" />
        </div>

        <div className="auth-visual-brand">
          <LabLogo size={72} />
          <span className="auth-visual-brand-name">Ethiopian Metrology Institute</span>
        </div>

        <div className="auth-visual-main">
          <h2 className="auth-visual-title">Analytical Instruments Logbook</h2>
          <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 1.6, maxWidth: 360, marginTop: 14 }}>
            Secure digital log sheets for the Chemical Metrology Laboratory.
          </p>
        </div>


      </div>

      {/* ── Right Form Panel (Centered card) ── */}
      <div className="auth-form-side">
        <div className="auth-content">
          <div className="auth-card-minimal">
            <div className="auth-card-header">
              <div style={{ display: "center", justifyContent: "center", marginBottom: "16px" }}>
                <LabLogo size={60} />
              </div>
              <p className="auth-eyebrow">Chemical Metrology System</p>
              <p className="auth-subtitle">Sign in to submit instrument daily use records and manage review logs.</p>
            </div>

            <form className="auth-form-minimal" onSubmit={handleSubmit}>
              {!twoFactorRequired ? (
                <>
                  <div className="auth-field-group">
                    <label className="auth-field-label" htmlFor="username">Username</label>
                    <div className="input-field">
                      <div className="input-icon"><User size={18} /></div>
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label" htmlFor="password">Password</label>
                    <div className="input-field">
                      <div className="input-icon"><Lock size={18} /></div>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="input-trailing-btn"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="twoFactorToken">
                    <ShieldCheck size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                    Authentication code
                  </label>
                  <div className="input-field">
                    <div className="input-icon"><Shield size={18} /></div>
                    <input
                      id="twoFactorToken"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      maxLength={6}
                      value={twoFactorToken}
                      onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, ""))}
                      autoFocus
                      required
                    />
                  </div>
                  <p className="auth-hint" style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                    Open your authenticator app and enter the current code for this account.
                  </p>
                </div>
              )}

              {message && (
                <div className="notice notice-error notice-inline" style={{ marginTop: "8px" }}>
                  <AlertTriangle size={16} />
                  <span>{message}</span>
                </div>
              )}

              <button
                className="btn-auth-primary"
                type="submit"
                disabled={submitting}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="spin" size={16} />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>{twoFactorRequired ? "Verify Code" : "Sign In"}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {twoFactorRequired && (
                <button
                  type="button"
                  className="auth-back-link"
                  style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginTop: 4 }}
                  onClick={() => { setTwoFactorRequired(false); setTwoFactorToken(""); setMessage(""); }}
                >
                  ← Use a different account
                </button>
              )}
            </form>


          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="settings-loading-wrap">
        <RefreshCw className="spin" size={36} style={{ color: "var(--primary)" }} />
        <p style={{ fontWeight: 600 }}>Loading Portal...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
