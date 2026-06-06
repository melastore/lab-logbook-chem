"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GENERATED_USER_ACCOUNTS } from "@/lib/generated-users";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LabLogo } from "@/components/LabLogo";

type Phase = "checking" | "ready" | "already-done" | "running" | "done" | "error";

const admins = GENERATED_USER_ACCOUNTS.filter((u) => u.role === "admin");

export default function SetupPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [result, setResult] = useState<{ created?: number; skipped?: number; errors?: string[]; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setPhase(d.ready ? "already-done" : "ready"))
      .catch(() => setPhase("ready"));
  }, []);

  async function runSetup() {
    setPhase("running");
    try {
      const r = await fetch("/api/setup", { method: "POST" });
      const d = await r.json();
      if (r.status === 409) {
        setPhase("already-done");
      } else if (!r.ok) {
        setResult(d);
        setPhase("error");
      } else {
        setResult(d);
        setPhase("done");
      }
    } catch (e) {
      setResult({ error: String(e) });
      setPhase("error");
    }
  }

  return (
    <main className="setup-shell">
      <ThemeToggle variant="floating" />
      <div className="setup-card">
        <header className="setup-header">
          <LabLogo size={48} />
          <div>
            <p className="setup-kicker">First-time setup</p>
            <p className="setup-title">Initialize Admin Accounts</p>
          </div>
        </header>

        <div className="setup-body">
          {phase === "already-done" && (
            <div className="setup-stack">
              <div className="notice notice-success" style={{ margin: 0 }}>
                Admin accounts are already set up. Go to the login page.
              </div>
              <Link className="btn btn-primary btn-lg" href="/login?redirect=/admin">
                Go to Supervisor Login
              </Link>
            </div>
          )}

          {phase === "checking" && (
            <div className="setup-loading">
              <div className="skeleton" style={{ height: 20, width: 220, margin: "0 auto 12px" }} />
              <div className="skeleton" style={{ height: 14, width: 160, margin: "0 auto" }} />
            </div>
          )}

          {phase === "ready" && (
            <div className="setup-stack">
              <p className="setup-copy">
                No admin accounts have been provisioned yet. Click below to create the
                3 supervisor accounts in Supabase Auth. This only runs once and is a
                no-op if admins already exist.
              </p>

              <div className="setup-table-wrap table-scroll">
                <table className="setup-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((u) => (
                      <tr key={u.username}>
                        <td style={{ fontWeight: 800, fontFamily: "var(--font-mono)" }}>{u.username}</td>
                        <td style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 14 }}>{u.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="notice notice-warning" style={{ margin: 0 }}>
                After setup, each admin must change their temporary password on first login.
              </div>

              <button className="btn btn-primary btn-lg" type="button" onClick={runSetup}>
                Create Admin Accounts
              </button>
            </div>
          )}

          {phase === "running" && (
            <div className="setup-running">
              <div className="setup-spinner" />
              <p style={{ fontWeight: 850, fontSize: 16 }}>Creating accounts in Supabase...</p>
              <p style={{ color: "var(--muted)", marginTop: 6, fontSize: 15 }}>This may take a few seconds.</p>
            </div>
          )}

          {phase === "done" && (
            <div className="setup-stack">
              <div className="notice notice-success" style={{ margin: 0 }}>
                Setup complete. {result?.created} account{result?.created !== 1 ? "s" : ""} created.
                {result?.errors && result.errors.length > 0 && (
                  <span> {result.errors.length} skipped, possibly because they already exist in Supabase Auth.</span>
                )}
              </div>

              <div className="setup-next">
                <p className="setup-next-title">Next steps</p>
                <ol>
                  <li>
                    Sign in as <code className="setup-code">admin01</code> with the private temporary password configured in <code className="setup-code">LAB_INITIAL_PASSWORD</code>.
                  </li>
                  <li>Change the temporary password when prompted.</li>
                  <li>Go to Supervisor Dashboard, then Users, and provision all users.</li>
                  <li>Go to Supervisor Dashboard, then Instruments, and fill in lab details.</li>
                </ol>
              </div>

              <Link className="btn btn-primary btn-lg" href="/login?redirect=/admin">
                Sign in as Supervisor
              </Link>
            </div>
          )}

          {phase === "error" && (
            <div className="setup-stack">
              <div className="notice notice-error" style={{ margin: 0 }}>
                <strong>Setup failed.</strong> {result?.error}
              </div>
              <p className="setup-copy">
                Check that your <code className="setup-code">.env</code> has valid{" "}
                <code className="setup-code">SUPABASE_URL</code> and{" "}
                <code className="setup-code">SUPABASE_SERVICE_ROLE_KEY</code>, then try again.
              </p>
              <button className="btn btn-outline" type="button" onClick={() => setPhase("ready")}>
                Try again
              </button>
            </div>
          )}
        </div>

        <footer className="setup-footer">
          <Link href="/" style={{ color: "var(--muted)" }}>Analyst logbook form</Link>
          <Link className="text-link" href="/login?redirect=/admin">Supervisor login</Link>
        </footer>
      </div>
    </main>
  );
}
