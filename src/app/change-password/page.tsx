"use client";

import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setMessageType("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessageType("error");
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (!response.ok) {
      setMessageType("error");
      setMessage("Failed to change password. Please try again.");
      setSubmitting(false);
      return;
    }

    setMessageType("success");
    setMessage("Password changed successfully. Redirecting…");
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 1200);
  }

  return (
    <main className="auth-container">
      <div className="auth-background">
        <div className="auth-blob auth-blob-1"></div>
        <div className="auth-blob auth-blob-2"></div>
        <div className="auth-grid-overlay"></div>
      </div>
      
      <ThemeToggle variant="floating" />
      
      <div className="auth-content">
        <div className="auth-card-modern">
          <div className="auth-card-header">
            <div className="lab-logo-circle">
              <KeyRoundIcon />
            </div>
            <p className="eyebrow">First-time login</p>
            <h1>Set your password</h1>
            <p className="auth-subtitle">
              For your security, you must change the temporary password before accessing the system.
            </p>
          </div>

          <form className="auth-form-modern" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat the password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {message && (
              <div className={`auth-message-banner auth-message-${messageType}`}>
                <InfoIcon />
                <span>{message}</span>
              </div>
            )}

            <button
              className="btn-auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className="btn-loading">
                  <LoadingSpinner />
                  Saving…
                </span>
              ) : (
                <span>Set new password & continue</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="auth-loading-screen">Loading...</div>}>
      <ChangePasswordForm />
    </Suspense>
  );
}

function KeyRoundIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4c.9.9 2.4.9 3.3 0l3.3-3.3c.9-.9.9-2.4 0-3.3L16.6 2.4c-.9-.9-2.4-.9-3.3 0L10 5.7c-.9.9-.9 2.4 0 3.3l1.4 1.4L10 12v3l-3 3-3 3H2v-3Z" />
      <circle cx="17" cy="7" r="1" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
