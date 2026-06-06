"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LabLogo } from "@/components/LabLogo";
import {
  User, Lock, Eye, EyeOff, ArrowRight, Shield, RefreshCw, AlertTriangle
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setMessage("Invalid username or password.");
      setSubmitting(false);
      return;
    }

    const result = await response.json();

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
          <LabLogo size={36} />
          <span className="auth-visual-brand-name">Ethiopian Metrology Institute</span>
        </div>

        <div className="auth-visual-main">
          <h2 className="auth-visual-title">Analytical Instruments Logbook</h2>
          <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 15, lineHeight: 1.6, maxWidth: 360, marginTop: 14 }}>
            Secure digital log sheets for the Chemical Metrology Laboratory.
          </p>
        </div>

        <div className="auth-visual-foot">
          <span>Version 1.2.4</span>
          <span>Security Level: High</span>
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
              <h1 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px", color: "var(--on-surface)" }}>Logbook Portal</h1>
              <p className="auth-subtitle">Sign in to submit instrument daily use records and manage review logs.</p>
            </div>

            <form className="auth-form-minimal" onSubmit={handleSubmit}>
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
                    <span>Sign In</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div className="auth-card-footer" style={{ marginTop: "32px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700" }}>
              <Shield size={14} style={{ color: "var(--primary)" }} />
              <span>Contact Administrator for credentials</span>
            </div>
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
