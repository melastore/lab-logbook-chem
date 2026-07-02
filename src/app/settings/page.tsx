"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  User, Lock, Palette, LayoutDashboard,
  Activity, Settings as SettingsIcon, LogOut, ArrowLeft,
  CheckCircle2, XCircle, RefreshCw,
  Type, Eye, EyeOff, Check, ShieldCheck,
  QrCode, Smartphone, Table2, LayoutList
} from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import { UserAvatar } from "@/components/UserAvatar";
import { useSettings } from "@/lib/settings-context";

type Notice = { type: "success" | "error"; text: string } | null;

function InlineNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <div className={`set-notice ${notice.type === "success" ? "ok" : "err"}`}>
      {notice.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span>{notice.text}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [avatarSeed, setAvatarSeed] = useState("");
  const [savedSeed, setSavedSeed] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileNotice, setProfileNotice] = useState<Notice>(null);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Two-factor authentication (TOTP / authenticator app)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ uri: string; secret: string; qr: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [twoFactorNotice, setTwoFactorNotice] = useState<Notice>(null);
  const [disabling2fa, setDisabling2fa] = useState(false);

  const { theme, setTheme, fontSize, setFontSize, formLayout, setFormLayout } = useSettings();
  const canAccessAdmin = user?.role === "admin" || user?.role === "supervisor";
  const avatarDirty = avatarSeed !== savedSeed;

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setAvatarSeed(d.user.avatarSeed);
          setSavedSeed(d.user.avatarSeed);
        } else {
          window.location.href = "/login?redirect=%2Fsettings";
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // Load current 2FA state once the user is known.
  useEffect(() => {
    fetch("/api/auth/2fa")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setTwoFactorEnabled(!!d.enabled))
      .catch(() => setTwoFactorEnabled(false));
  }, []);

  // Begin enrollment: get a fresh secret + otpauth URI, render a QR locally.
  async function startTwoFactorSetup() {
    setTwoFactorBusy(true);
    setTwoFactorNotice(null);
    setTwoFactorCode("");
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start setup.");
      const QRCode = await import("qrcode");
      const toDataURL = QRCode.toDataURL || QRCode.default?.toDataURL;
      const qr = await toDataURL(data.uri, { margin: 1, width: 220 });
      setTwoFactorSetup({ uri: data.uri, secret: data.secret, qr });
    } catch (e) {
      setTwoFactorNotice({ type: "error", text: e instanceof Error ? e.message : "Setup failed." });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function confirmTwoFactor() {
    setTwoFactorBusy(true);
    setTwoFactorNotice(null);
    try {
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed.");
      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setTwoFactorCode("");
      setTwoFactorNotice({ type: "success", text: "Two-factor authentication is now on." });
    } catch (e) {
      setTwoFactorNotice({ type: "error", text: e instanceof Error ? e.message : "Verification failed." });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function disableTwoFactor() {
    setTwoFactorBusy(true);
    setTwoFactorNotice(null);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not turn off 2FA.");
      setTwoFactorEnabled(false);
      setDisabling2fa(false);
      setTwoFactorCode("");
      setTwoFactorNotice({ type: "success", text: "Two-factor authentication is now off." });
    } catch (e) {
      setTwoFactorNotice({ type: "error", text: e instanceof Error ? e.message : "Could not turn off 2FA." });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  function shuffleAvatar() {
    const random = new Uint32Array(2);
    crypto.getRandomValues(random);
    setAvatarSeed(`avatar_${random[0].toString(36)}_${random[1].toString(36)}`);
    setProfileNotice(null);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);

    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarSeed }),
    });
    const result = await response.json();

    if (!response.ok) {
      setProfileNotice({ type: "error", text: result.error || "Could not save your avatar." });
      setSavingProfile(false);
      return;
    }

    setUser(result.user);
    setAvatarSeed(result.user.avatarSeed);
    setSavedSeed(result.user.avatarSeed);
    setProfileNotice({ type: "success", text: "Avatar saved." });
    setSavingProfile(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice(null);

    if (newPassword.length < 8) {
      setPasswordNotice({ type: "error", text: "Your new password needs at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: "error", text: "The two passwords don't match." });
      return;
    }

    setSavingPassword(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setPasswordNotice({ type: "error", text: result.error || "Could not update your password. Try again." });
    } else {
      setPasswordNotice({ type: "success", text: "Password updated. Use it the next time you sign in." });
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
    setSavingPassword(false);
  }

  const handleThemeChange = (t: "light" | "dark") => {
    setTheme(t);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("theme", t);
      } catch {}
      window.dispatchEvent(new CustomEvent("themechange", { detail: t }));
    }
  };

  const strengthDetails = getPasswordStrength(newPassword);

  function getPasswordStrength(pwd: string) {
    if (!pwd) return { score: 0, criteria: { length: false, uppercase: false, lowercase: false, number: false, special: false } };
    const criteria = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    };
    const score = Object.values(criteria).filter(Boolean).length;
    return { score, criteria };
  }

  const getStrengthLabel = (score: number) => {
    if (score === 0) return "";
    if (score <= 2) return "Weak";
    if (score <= 4) return "Fair";
    return "Strong";
  };

  const getStrengthColor = (score: number) => {
    if (score <= 2) return "var(--error)";
    if (score <= 4) return "var(--warning)";
    return "var(--success)";
  };

  const criteriaList = [
    { key: "length" as const, label: "8+ characters" },
    { key: "uppercase" as const, label: "Uppercase letter" },
    { key: "lowercase" as const, label: "Lowercase letter" },
    { key: "number" as const, label: "Number" },
    { key: "special" as const, label: "Symbol (!@#…)" },
  ];

  if (loading) return (
    <div className="settings-loading-wrap">
      <RefreshCw className="spin" size={36} style={{ color: "var(--primary)" }} />
      <p style={{ fontWeight: 600, fontSize: "15px" }}>Loading your settings…</p>
    </div>
  );

  return (
    <main className="app-shell">
      <aside className="app-rail">
        <div className="rail-brand">
          <div className="lab-logo-modern"><SettingsIcon size={24} /></div>
          <span>Settings</span>
        </div>
        <nav className="rail-nav">
          <Link className="rail-link" href="/"><Activity size={22} /><span>Entry</span></Link>
          {canAccessAdmin && (
            <Link className="rail-link" href="/admin"><LayoutDashboard size={22} /><span>Admin</span></Link>
          )}
          <Link className="rail-link active" href="/settings"><SettingsIcon size={22} /><span>Settings</span></Link>
        </nav>
      </aside>

      <div className="app-frame settings-frame-modern">
        <header className="settings-header">
          <div className="settings-header-left">
            <Link href="/" className="settings-back-btn" title="Back to Entry">
              <ArrowLeft size={22} />
            </Link>
            <div>
              <h1>Settings</h1>
              <p className="settings-header-sub">Manage your account and preferences</p>
            </div>
          </div>
          <div className="settings-header-right">
            {user && (
              <>
                <span className="user-chip shadow-sm">
                  <UserAvatar name={user.username} seed={avatarSeed} size="sm" />
                  <span className="user-chip-name">{user.username}</span>
                  <span className="user-role-badge">{user.role}</span>
                </span>
                <button className="btn btn-outline btn-sm btn-icon-gap" onClick={logout}>
                  <LogOut size={16} /> <span>Sign out</span>
                </button>
              </>
            )}
          </div>
        </header>

        <div className="settings-stack">

          {/* ── Profile ── */}
          <section className="set-card">
            <header className="set-head">
              <div className="set-head-icon"><User size={20} /></div>
              <div>
                <h2>Profile</h2>
                <p>How you appear across the logbook.</p>
              </div>
            </header>

            <form onSubmit={saveProfile}>
              <div className="set-body">
                <div className="set-profile-row">
                  <div className="profile-avatar-wrap">
                    <UserAvatar name={user?.username || ""} seed={avatarSeed} size="lg" />
                    <button className="avatar-edit-badge" onClick={shuffleAvatar} title="Shuffle avatar" type="button">
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div className="set-profile-text">
                    <h3>{user?.fullName || "—"}</h3>
                    <p>{user?.email || "No email on file"}</p>
                    <span className="user-role-badge">{user?.role}</span>
                  </div>
                </div>

                <div className="set-divider" />

                <div className="set-field-row">
                  <div className="set-field-info">
                    <label>Username</label>
                    <p>Set by an administrator — used to sign in.</p>
                  </div>
                  <code className="set-username-chip">{user?.username}</code>
                </div>

                <div className="set-field-row">
                  <div className="set-field-info">
                    <label>Avatar</label>
                    <p>Generated just for you. Don&apos;t like it? Shuffle until one fits.</p>
                  </div>
                  <button type="button" className="btn btn-outline btn-icon-gap" onClick={shuffleAvatar}>
                    <RefreshCw size={15} /> <span>Shuffle</span>
                  </button>
                </div>

                <InlineNotice notice={profileNotice} />
              </div>

              <footer className="set-foot">
                <span className="set-foot-hint">{avatarDirty ? "You have an unsaved avatar." : ""}</span>
                <button className="btn btn-primary" type="submit" disabled={savingProfile || !avatarDirty}>
                  {savingProfile && <RefreshCw className="spin" size={15} style={{ marginRight: 8 }} />}
                  <span>{savingProfile ? "Saving…" : "Save avatar"}</span>
                </button>
              </footer>
            </form>
          </section>

          {/* ── Password ── */}
          <section className="set-card">
            <header className="set-head">
              <div className="set-head-icon"><Lock size={20} /></div>
              <div>
                <h2>Password</h2>
                <p>Use at least 8 characters — a mix of letters, numbers and symbols is strongest.</p>
              </div>
            </header>

            <form onSubmit={savePassword}>
              <div className="set-body">
                <div className="form-row-2">
                  <div className="field-modern">
                    <label>New password</label>
                    <div className="input-password-wrapper">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        style={{ paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        title={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="field-modern">
                    <label>Confirm new password</label>
                    <div className="input-password-wrapper">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Type it again"
                        autoComplete="new-password"
                        style={{ paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {newPassword && (
                  <div className="strength-meter">
                    <div className="strength-meter-head">
                      <span>Password strength</span>
                      <span style={{ color: getStrengthColor(strengthDetails.score) }}>{getStrengthLabel(strengthDetails.score)}</span>
                    </div>
                    <div className="strength-bar-bg">
                      <div
                        className="strength-bar-fill"
                        style={{
                          width: `${(strengthDetails.score / 5) * 100}%`,
                          backgroundColor: getStrengthColor(strengthDetails.score)
                        }}
                      />
                    </div>
                    <div className="strength-criteria">
                      {criteriaList.map((c) => (
                        <div key={c.key} className={`criterion-item ${strengthDetails.criteria[c.key] ? "met" : ""}`}>
                          <span className="criterion-icon">
                            {strengthDetails.criteria[c.key] ? <Check size={14} /> : <span className="criterion-dot" />}
                          </span>
                          <span>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <InlineNotice notice={passwordNotice} />
              </div>

              <footer className="set-foot">
                <span className="set-foot-hint">You&apos;ll use the new password from your next sign-in.</span>
                <button className="btn btn-primary" type="submit" disabled={savingPassword || !newPassword || !confirmPassword}>
                  {savingPassword && <RefreshCw className="spin" size={15} style={{ marginRight: 8 }} />}
                  <span>{savingPassword ? "Updating…" : "Update password"}</span>
                </button>
              </footer>
            </form>
          </section>

          {/* ── Two-factor authentication ── */}
          <section className="set-card">
            <header className="set-head">
              <div className="set-head-icon"><Smartphone size={20} /></div>
              <div>
                <h2>Two-factor authentication</h2>
                <p>Ask for a code from your authenticator app at sign-in — even if someone knows your password, they can&apos;t get in.</p>
              </div>
            </header>

            <div className="set-body">
              <div className="twofa-status-row">
                <div className="twofa-status-text">
                  <span className={`twofa-badge ${twoFactorEnabled ? "on" : "off"}`}>
                    {twoFactorEnabled ? <ShieldCheck size={15} /> : <Lock size={15} />}
                    {twoFactorEnabled === null ? "Checking…" : twoFactorEnabled ? "On" : "Off"}
                  </span>
                  <p>
                    {twoFactorEnabled
                      ? "Your account asks for a 6-digit code at sign-in."
                      : "Works with Google Authenticator, Authy, 1Password and similar apps."}
                  </p>
                </div>
                {twoFactorEnabled === false && !twoFactorSetup && (
                  <button type="button" className="btn btn-primary btn-icon-gap" onClick={startTwoFactorSetup} disabled={twoFactorBusy}>
                    {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <QrCode size={16} />}
                    <span>Turn on</span>
                  </button>
                )}
                {twoFactorEnabled === true && !disabling2fa && (
                  <button type="button" className="btn btn-outline" onClick={() => { setDisabling2fa(true); setTwoFactorCode(""); setTwoFactorNotice(null); }}>
                    Turn off
                  </button>
                )}
              </div>

              {/* Enrollment: scan QR + confirm a code */}
              {twoFactorSetup && (
                <div className="twofa-enroll">
                  <ol className="twofa-steps">
                    <li>Scan this QR code with your authenticator app.</li>
                    <li>Enter the 6-digit code it shows to confirm.</li>
                  </ol>
                  <div className="twofa-qr-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={twoFactorSetup.qr} alt="2FA QR code" width={200} height={200} />
                    <div className="twofa-manual">
                      <span>Can&apos;t scan? Enter this key manually:</span>
                      <code>{twoFactorSetup.secret}</code>
                    </div>
                  </div>
                  <div className="twofa-confirm">
                    <input
                      className="input-modern"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                    />
                    <button type="button" className="btn btn-primary btn-icon-gap" onClick={confirmTwoFactor} disabled={twoFactorBusy || twoFactorCode.length !== 6}>
                      {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <Check size={16} />}
                      <span>Verify &amp; turn on</span>
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(""); setTwoFactorNotice(null); }} disabled={twoFactorBusy}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Disable: require a current code */}
              {disabling2fa && (
                <div className="twofa-confirm" style={{ marginTop: 16 }}>
                  <input
                    className="input-modern"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Current code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <button type="button" className="btn btn-primary" onClick={disableTwoFactor} disabled={twoFactorBusy || twoFactorCode.length !== 6}>
                    {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <span>Confirm turn off</span>}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => { setDisabling2fa(false); setTwoFactorCode(""); }} disabled={twoFactorBusy}>
                    Cancel
                  </button>
                </div>
              )}

              <InlineNotice notice={twoFactorNotice} />
            </div>
          </section>

          {/* ── Appearance ── */}
          <section className="set-card">
            <header className="set-head">
              <div className="set-head-icon"><Palette size={20} /></div>
              <div>
                <h2>Appearance</h2>
                <p>Theme, text size, and how data-entry forms are laid out. Changes apply instantly.</p>
              </div>
            </header>

            <div className="set-body set-body-groups">

              <div className="appearance-group">
                <label className="group-label">Theme</label>
                <div className="theme-options-modern">
                  <button
                    type="button"
                    className={`theme-opt ${theme === "light" ? "active" : ""}`}
                    onClick={() => handleThemeChange("light")}
                  >
                    <div className="theme-preview-mock light-mode">
                      <div className="mock-sidebar" />
                      <div className="mock-main">
                        <div className="mock-header" />
                        <div className="mock-row" />
                        <div className="mock-row short" />
                      </div>
                    </div>
                    <div className="theme-opt-label">
                      <span>Light</span>
                      {theme === "light" && <CheckCircle2 size={16} style={{ color: "var(--primary)" }} />}
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`theme-opt ${theme === "dark" ? "active" : ""}`}
                    onClick={() => handleThemeChange("dark")}
                  >
                    <div className="theme-preview-mock dark-mode">
                      <div className="mock-sidebar" style={{ background: "#334155" }} />
                      <div className="mock-main">
                        <div className="mock-header" style={{ background: "#334155" }} />
                        <div className="mock-row" style={{ background: "#334155" }} />
                        <div className="mock-row short" style={{ background: "#334155" }} />
                      </div>
                    </div>
                    <div className="theme-opt-label">
                      <span>Dark</span>
                      {theme === "dark" && <CheckCircle2 size={16} style={{ color: "var(--primary)" }} />}
                    </div>
                  </button>
                </div>
              </div>

              <div className="appearance-group">
                <label className="group-label">Text size</label>
                <div className="font-options-modern">
                  {(["small", "medium", "large"] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={`font-opt ${fontSize === s ? "active" : ""}`}
                      onClick={() => setFontSize(s)}
                    >
                      <Type size={s === "small" ? 14 : s === "medium" ? 18 : 22} />
                      <span style={{ textTransform: "capitalize" }}>{s}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="appearance-group">
                <label className="group-label">Data-entry layout</label>
                <div className="layout-options-modern">
                  <button
                    type="button"
                    className={`layout-opt ${formLayout === "spreadsheet" ? "active" : ""}`}
                    onClick={() => setFormLayout("spreadsheet")}
                  >
                    <div className="layout-opt-mock">
                      <div className="mock-sheet">
                        <span /><span /><span /><span /><span /><span /><span /><span /><span />
                      </div>
                    </div>
                    <div className="layout-opt-text">
                      <div className="layout-opt-title"><Table2 size={15} /> Spreadsheet</div>
                      <div className="layout-opt-desc">All fields in one compact grid — fastest for routine entries.</div>
                    </div>
                    {formLayout === "spreadsheet" && <CheckCircle2 size={16} className="layout-opt-check" />}
                  </button>

                  <button
                    type="button"
                    className={`layout-opt ${formLayout === "cards" ? "active" : ""}`}
                    onClick={() => setFormLayout("cards")}
                  >
                    <div className="layout-opt-mock">
                      <div className="mock-stack">
                        <span /><span />
                      </div>
                    </div>
                    <div className="layout-opt-text">
                      <div className="layout-opt-title"><LayoutList size={15} /> Vertical cards</div>
                      <div className="layout-opt-desc">One field per line in roomy cards — easiest to read and review.</div>
                    </div>
                    {formLayout === "cards" && <CheckCircle2 size={16} className="layout-opt-check" />}
                  </button>
                </div>
              </div>

            </div>
          </section>

        </div>
      </div>

    </main>
  );
}
