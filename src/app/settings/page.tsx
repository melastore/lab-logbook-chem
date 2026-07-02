"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { 
  User, Lock, Palette, LayoutDashboard, 
  Activity, Settings as SettingsIcon, LogOut, ArrowLeft, 
  CheckCircle2, XCircle, RefreshCw, 
  Type, Fingerprint, Eye, EyeOff, Check, ShieldCheck,
  QrCode, Smartphone
} from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import { UserAvatar } from "@/components/UserAvatar";
import { useSettings } from "@/lib/settings-context";

type Notice = { type: "success" | "error"; text: string } | null;

export default function SettingsPage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [username, setUsername] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
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

  useEffect(() => {
    fetch("/api/auth/profile")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          setUser(d.user);
          setUsername(d.user.username);
          setAvatarSeed(d.user.avatarSeed);
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
      setTwoFactorNotice({ type: "success", text: "Two-factor authentication is now enabled." });
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
      if (!res.ok) throw new Error(data.error || "Could not disable 2FA.");
      setTwoFactorEnabled(false);
      setDisabling2fa(false);
      setTwoFactorCode("");
      setTwoFactorNotice({ type: "success", text: "Two-factor authentication disabled." });
    } catch (e) {
      setTwoFactorNotice({ type: "error", text: e instanceof Error ? e.message : "Could not disable 2FA." });
    } finally {
      setTwoFactorBusy(false);
    }
  }

  function generateAvatar() {
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
      setProfileNotice({ type: "error", text: result.error || "Profile update failed." });
      setSavingProfile(false);
      return;
    }

    setUser(result.user);
    setUsername(result.user.username);
    setAvatarSeed(result.user.avatarSeed);
    setProfileNotice({ type: "success", text: "Identity profile successfully synchronized." });
    setSavingProfile(false);
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordNotice(null);

    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: "error", text: "Passwords do not match." });
      setSavingPassword(false);
      return;
    }

    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const result = await response.json();

    if (!response.ok) {
      setPasswordNotice({ type: "error", text: result.error || "Password update failed." });
    } else {
      setPasswordNotice({ type: "success", text: "Password securely updated." });
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
    if (score <= 2) return "Weak Password";
    if (score <= 4) return "Fair Password";
    return "Strong Password";
  };

  const getStrengthColor = (score: number) => {
    if (score <= 2) return "var(--error)";
    if (score <= 4) return "var(--warning)";
    return "var(--success)";
  };

  if (loading) return (
    <div className="settings-loading-wrap">
      <RefreshCw className="spin" size={36} style={{ color: "var(--primary)" }} />
      <p style={{ fontWeight: 600, fontSize: "15px" }}>Configuring your dashboard settings...</p>
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
        <header className="settings-header" style={{ padding: "32px 48px", borderBottom: "1px solid var(--outline-variant)", background: "var(--surface)" }}>
          <div className="settings-header-left" style={{ gap: "24px" }}>
            <Link href="/" className="settings-back-btn" title="Back to Entry">
              <ArrowLeft size={22} />
            </Link>
            <div>
              <p className="eyebrow" style={{ color: "var(--primary)", letterSpacing: "1px", fontWeight: "800" }}>USER PREFERENCES</p>
              <h1 style={{ fontSize: "32px", letterSpacing: "-0.5px" }}>Control Center</h1>
            </div>
          </div>
          <div className="settings-header-right">
            {user && (
              <>
                <span className="user-chip shadow-sm" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 20px", background: "var(--surface-1)", border: "1px solid var(--outline-variant)", borderRadius: "99px" }}>
                  <UserAvatar name={user.username} seed={avatarSeed} size="sm" />
                  <span className="user-chip-name" style={{ fontWeight: 800, fontSize: "14px" }}>{user.username}</span>
                  <span className="user-role-badge" style={{ fontSize: "11px", padding: "4px 10px", background: "var(--primary-container)", color: "var(--primary)" }}>{user.role}</span>
                </span>
                <button className="btn btn-outline btn-sm btn-icon-gap" onClick={logout} style={{ display: "inline-flex", alignItems: "center", gap: "8px", borderRadius: "99px", padding: "0 20px", height: "42px" }}>
                  <LogOut size={16} /> <span style={{ fontWeight: 700 }}>Sign out</span>
                </button>
              </>
            )}
          </div>
        </header>

        <div className="settings-dashboard">

            {/* PROFILE */}
            <div className="settings-tab-content">
                <div className="section-head">
                  <div className="section-icon"><User size={22} /></div>
                  <div>
                    <h2>Identity Profile</h2>
                    <p>Manage your procedurally generated avatar and lab profile details.</p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="profile-hero-modern">
                    <div className="profile-avatar-wrap">
                      <UserAvatar name={username} seed={avatarSeed} size="lg" />
                      <button className="avatar-edit-badge" onClick={generateAvatar} title="Regenerate Avatar" type="button">
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <div className="profile-hero-text">
                      <h3 style={{ color: "var(--on-surface)" }}>{user?.fullName || "Lab Analyst"}</h3>
                      <p>{user?.email || "No email registered"}</p>
                      <div className="user-role-badge" style={{ textTransform: "capitalize" }}>
                        {user?.role} Officer
                      </div>
                    </div>
                  </div>

                  <form className="settings-form-modern" onSubmit={saveProfile}>
                    <div className="field-modern">
                      <label>System Username</label>
                      <div className="input-with-icon">
                        <Fingerprint size={18} className="input-icon" />
                        <input value={username} disabled className="disabled" type="text" onChange={() => {}} />
                      </div>
                      <p className="field-hint">Your login username is managed by administrators and cannot be altered.</p>
                    </div>

                    <div className="field-modern">
                      <label>Procedural Avatar Picture</label>
                      <p className="field-hint">Generates a unique chemical decoration pattern based on a cryptographic seed.</p>
                      <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                        <button type="button" className="btn btn-outline btn-icon-gap" onClick={generateAvatar} style={{ borderRadius: "12px" }}>
                          <RefreshCw size={15} /> <span>Roll New Avatar Seed</span>
                        </button>
                      </div>
                    </div>

                    {profileNotice && (
                      <div className={`notice notice-${profileNotice.type} notice-inline`} style={{
                        background: profileNotice.type === "success" ? "var(--success-container)" : "var(--error-container)",
                        color: profileNotice.type === "success" ? "var(--success)" : "var(--error)",
                        border: `1px solid ${profileNotice.type === "success" ? "var(--success)" : "var(--error)"}20`
                      }}>
                        {profileNotice.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        <span>{profileNotice.text}</span>
                      </div>
                    )}

                    <div className="settings-footer-actions">
                      <button className="btn btn-primary" type="submit" disabled={savingProfile} style={{ borderRadius: "12px", padding: "12px 24px" }}>
                        {savingProfile && <RefreshCw className="spin" size={15} style={{ marginRight: "8px" }} />}
                        <span>{savingProfile ? "Saving Profile..." : "Apply Profile Seed"}</span>
                      </button>
                    </div>
                  </form>
                </div>
            </div>

            {/* SECURITY */}
            <div className="settings-tab-content">
                <div className="section-head">
                  <div className="section-icon"><Lock size={22} /></div>
                  <div>
                    <h2>Credentials & Safety</h2>
                    <p>Update your credentials. Strong passwords help protect analytical data integrity.</p>
                  </div>
                </div>

                <div className="settings-card">
                  <form className="settings-form-modern" onSubmit={savePassword}>
                    <div className="form-row-2">
                      <div className="field-modern">
                        <label>New Password</label>
                        <div className="input-password-wrapper">
                          <input 
                            type={showNewPassword ? "text" : "password"} 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
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
                        <label>Confirm Password</label>
                        <div className="input-password-wrapper">
                          <input 
                            type={showConfirmPassword ? "text" : "password"} 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
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

                    {/* LIVE PASSWORD STRENGTH METER */}
                    {newPassword && (
                      <div className="strength-meter">
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
                          <span style={{ color: "var(--muted)" }}>Complexity Strength:</span>
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
                          <div className={`criterion-item ${strengthDetails.criteria.length ? "met" : ""}`}>
                            <span className="criterion-icon">{strengthDetails.criteria.length ? <Check size={14} /> : <XCircle size={14} style={{ color: "var(--error)" }} />}</span>
                            <span>At least 8 characters</span>
                          </div>
                          <div className={`criterion-item ${strengthDetails.criteria.uppercase ? "met" : ""}`}>
                            <span className="criterion-icon">{strengthDetails.criteria.uppercase ? <Check size={14} /> : <XCircle size={14} style={{ color: "var(--error)" }} />}</span>
                            <span>Uppercase letter (A-Z)</span>
                          </div>
                          <div className={`criterion-item ${strengthDetails.criteria.lowercase ? "met" : ""}`}>
                            <span className="criterion-icon">{strengthDetails.criteria.lowercase ? <Check size={14} /> : <XCircle size={14} style={{ color: "var(--error)" }} />}</span>
                            <span>Lowercase letter (a-z)</span>
                          </div>
                          <div className={`criterion-item ${strengthDetails.criteria.number ? "met" : ""}`}>
                            <span className="criterion-icon">{strengthDetails.criteria.number ? <Check size={14} /> : <XCircle size={14} style={{ color: "var(--error)" }} />}</span>
                            <span>Digit number (0-9)</span>
                          </div>
                          <div className={`criterion-item ${strengthDetails.criteria.special ? "met" : ""}`}>
                            <span className="criterion-icon">{strengthDetails.criteria.special ? <Check size={14} /> : <XCircle size={14} style={{ color: "var(--error)" }} />}</span>
                            <span>Special character (e.g. !@#$)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {passwordNotice && (
                      <div className={`notice notice-${passwordNotice.type} notice-inline`} style={{
                        background: passwordNotice.type === "success" ? "var(--success-container)" : "var(--error-container)",
                        color: passwordNotice.type === "success" ? "var(--success)" : "var(--error)",
                        border: `1px solid ${passwordNotice.type === "success" ? "var(--success)" : "var(--error)"}20`
                      }}>
                        {passwordNotice.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        <span>{passwordNotice.text}</span>
                      </div>
                    )}

                    <div className="settings-footer-actions">
                      <button className="btn btn-primary" type="submit" disabled={savingPassword} style={{ borderRadius: "12px", padding: "12px 24px" }}>
                        {savingPassword && <RefreshCw className="spin" size={15} style={{ marginRight: "8px" }} />}
                        <span>Update Password</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* TWO-FACTOR AUTHENTICATION */}
                <div className="section-head">
                  <div className="section-icon"><Smartphone size={22} /></div>
                  <div>
                    <h2>Two-Factor Authentication</h2>
                    <p>Add a one-time code from an authenticator app (Google Authenticator, Authy, 1Password…) on top of your password.</p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="twofa-status-row">
                    <div className="twofa-status-text">
                      <span className={`twofa-badge ${twoFactorEnabled ? "on" : "off"}`}>
                        {twoFactorEnabled ? <ShieldCheck size={15} /> : <Lock size={15} />}
                        {twoFactorEnabled === null ? "Checking…" : twoFactorEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <p>
                        {twoFactorEnabled
                          ? "Your account asks for an authenticator code at sign-in."
                          : "Protect your account with a time-based one-time code."}
                      </p>
                    </div>
                    {twoFactorEnabled === false && !twoFactorSetup && (
                      <button type="button" className="btn btn-primary" onClick={startTwoFactorSetup} disabled={twoFactorBusy}>
                        {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <QrCode size={16} />}
                        <span style={{ marginLeft: 8 }}>Turn on 2FA</span>
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
                        <button type="button" className="btn btn-primary" onClick={confirmTwoFactor} disabled={twoFactorBusy || twoFactorCode.length !== 6}>
                          {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <Check size={16} />}
                          <span style={{ marginLeft: 8 }}>Verify &amp; Enable</span>
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
                        {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <span>Confirm disable</span>}
                      </button>
                      <button type="button" className="btn btn-outline" onClick={() => { setDisabling2fa(false); setTwoFactorCode(""); }} disabled={twoFactorBusy}>
                        Cancel
                      </button>
                    </div>
                  )}

                  {twoFactorNotice && (
                    <div className={`notice notice-${twoFactorNotice.type} notice-inline`} style={{
                      marginTop: 16,
                      background: twoFactorNotice.type === "success" ? "var(--success-container)" : "var(--error-container)",
                      color: twoFactorNotice.type === "success" ? "var(--success)" : "var(--error)",
                      border: `1px solid ${twoFactorNotice.type === "success" ? "var(--success)" : "var(--error)"}20`
                    }}>
                      {twoFactorNotice.type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      <span>{twoFactorNotice.text}</span>
                    </div>
                  )}
                </div>
            </div>

            {/* APPEARANCE */}
            <div className="settings-tab-content settings-tab-wide">
                <div className="section-head">
                  <div className="section-icon"><Palette size={22} /></div>
                  <div>
                    <h2>UI Theme & Layout</h2>
                    <p>Customize the visual layout rendering and typography scaling for spreadsheet components.</p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="appearance-grid-modern">
                    
                    {/* COLOR THEME SELECTOR WITH MOCKUPS */}
                    <div className="appearance-group">
                      <label className="group-label">Interface Theme</label>
                      <p className="field-hint">Switch between dark mode and clean white configurations.</p>
                      
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
                            <span>Light Interface</span>
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
                            <span>Dark Interface</span>
                            {theme === "dark" && <CheckCircle2 size={16} style={{ color: "var(--primary)" }} />}
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* FONT SIZING SCALER */}
                    <div className="appearance-group">
                      <label className="group-label">Interface Font Size</label>
                      <p className="field-hint">Scales typography across the entire interface — forms, tables, navigation, and dialogs.</p>
                      
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

                    {/* FORM LAYOUT MOCKUPS */}
                    <div className="appearance-group">
                      <label className="group-label">Data Entry Layout</label>
                      <p className="field-hint">Configure how structured document records fields are visualised on page load.</p>
                      
                      <div className="layout-options-modern">
                        <button 
                          type="button"
                          className={`layout-opt ${formLayout === "spreadsheet" ? "active" : ""}`}
                          onClick={() => setFormLayout("spreadsheet")}
                        >
                          <div className="layout-opt-title">Spreadsheet Mode</div>
                          <div className="layout-opt-desc">Displays fields in a compact spreadsheet matrix grid. Highly efficient for rapid cell entries.</div>
                        </button>

                        <button 
                          type="button"
                          className={`layout-opt ${formLayout === "cards" ? "active" : ""}`}
                          onClick={() => setFormLayout("cards")}
                        >
                          <div className="layout-opt-title">Vertical Stack Cards</div>
                          <div className="layout-opt-desc">Splits columns into individually padded visual card blocks. Optimized for readability.</div>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
            </div>

        </div>
      </div>

    </main>
  );
}
