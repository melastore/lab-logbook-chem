"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  User, Lock, Palette,
  CheckCircle2, XCircle, RefreshCw,
  Type, Eye, EyeOff, Check, ShieldCheck,
  QrCode, Smartphone, Table2, LayoutList, FileSpreadsheet
} from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import { UserAvatar } from "@/components/UserAvatar";
import { AppHeader } from "@/components/AppHeader";
import { useSettings } from "@/lib/settings-context";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
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
  const avatarDirty = avatarSeed !== savedSeed;
  const [activeSection, setActiveSection] = useState("profile");

  // Highlight the section currently in view in the side / top menu.
  useEffect(() => {
    if (loading) return;
    const els = ["profile", "password", "two-factor", "appearance"]
      .map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActiveSection(top.target.id);
    }, { rootMargin: "-120px 0px -55% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [loading]);

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

    if (!currentPassword) {
      setPasswordNotice({ type: "error", text: "Enter your current password to confirm the change." });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordNotice({ type: "error", text: `Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.` });
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
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setPasswordNotice({ type: "error", text: result.error || "Could not update your password. Try again." });
    } else {
      setPasswordNotice({ type: "success", text: "Password updated. Use it the next time you sign in." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setShowCurrentPassword(false);
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
      length: pwd.length >= MIN_PASSWORD_LENGTH,
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
    { key: "length" as const, label: `${MIN_PASSWORD_LENGTH}+ characters` },
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

  const sections = [
    { id: "profile", label: "Profile", icon: <User size={17} /> },
    { id: "password", label: "Password", icon: <Lock size={17} /> },
    { id: "two-factor", label: "Two-factor", icon: <Smartphone size={17} /> },
    { id: "appearance", label: "Appearance", icon: <Palette size={17} /> },
  ];

  const passwordToggle = (shown: boolean, set: (v: boolean) => void) => (
    <button type="button" className="st-pw-toggle" onClick={() => set(!shown)} aria-label={shown ? "Hide password" : "Show password"} title={shown ? "Hide" : "Show"}>
      {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );

  return (
    <main className="app-layout">
      <AppHeader user={user ? { ...user, avatarSeed: savedSeed || user.avatarSeed } : null} />
      <div className="app-page st">
        <header className="st-head">
          <h1>Settings</h1>
          <p>Your account, security and how the logbook looks.</p>
        </header>

        <div className="st-layout">
          <nav className="st-nav" aria-label="Settings sections">
            {sections.map((sec) => (
              <a key={sec.id} href={`#${sec.id}`} className={`st-nav-link ${activeSection === sec.id ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); setActiveSection(sec.id); }}>
                {sec.icon}<span>{sec.label}</span>
                {sec.id === "two-factor" && twoFactorEnabled !== null && <span className={`st-dot ${twoFactorEnabled ? "on" : "off"}`} aria-label={twoFactorEnabled ? "on" : "off"} />}
              </a>
            ))}
          </nav>

          <div className="st-sections">
            {/* ── Profile ── */}
            <section id="profile" className="st-card" aria-labelledby="st-profile">
              <form onSubmit={saveProfile}>
                <div className="st-profile">
                  <div className="st-avatar">
                    <UserAvatar name={user?.username || ""} seed={avatarSeed} size="lg" />
                  </div>
                  <div className="st-profile-text">
                    <h2 id="st-profile">{user?.fullName || "—"}</h2>
                    <p>{user?.email || "No email on file"}</p>
                    <div className="st-tags">
                      <span className="user-role-badge">{user?.role}</span>
                      <code>@{user?.username}</code>
                    </div>
                  </div>
                </div>

                <div className="st-row">
                  <div className="st-row-text">
                    <strong>Avatar</strong>
                    <span>Generated for you. Shuffle until you like one, then save.</span>
                  </div>
                  <div className="st-row-actions">
                    <button type="button" className="btn btn-outline btn-icon-gap" onClick={shuffleAvatar}>
                      <RefreshCw size={15} /> <span>Shuffle</span>
                    </button>
                    {avatarDirty && (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={() => setAvatarSeed(savedSeed)} disabled={savingProfile}>Undo</button>
                        <button className="btn btn-primary" type="submit" disabled={savingProfile}>
                          {savingProfile ? "Saving…" : "Save"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="st-row">
                  <div className="st-row-text">
                    <strong>Name, username and email</strong>
                    <span>Managed by an admin. Ask them if something is wrong.</span>
                  </div>
                </div>
                <InlineNotice notice={profileNotice} />
              </form>
            </section>

            {/* ── Password ── */}
            <section id="password" className="st-card" aria-labelledby="st-password">
              <div className="st-card-head">
                <span className="st-card-icon"><Lock size={18} /></span>
                <div>
                  <h2 id="st-password">Password</h2>
                  <p>At least {MIN_PASSWORD_LENGTH} characters. A mix of letters, numbers and symbols is strongest.</p>
                </div>
              </div>

              <form onSubmit={savePassword} className="st-form">
                <div className="st-field">
                  <label htmlFor="currentPassword">Current password</label>
                  <div className="st-pw">
                    <input id="currentPassword" type={showCurrentPassword ? "text" : "password"} value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirm it's you" autoComplete="current-password" />
                    {passwordToggle(showCurrentPassword, setShowCurrentPassword)}
                  </div>
                </div>

                <div className="st-grid-2">
                  <div className="st-field">
                    <label htmlFor="newPassword">New password</label>
                    <div className="st-pw">
                      <input id="newPassword" type={showNewPassword ? "text" : "password"} value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} autoComplete="new-password" />
                      {passwordToggle(showNewPassword, setShowNewPassword)}
                    </div>
                  </div>
                  <div className="st-field">
                    <label htmlFor="confirmPassword">Confirm new password</label>
                    <div className="st-pw">
                      <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type it again" autoComplete="new-password"
                        aria-invalid={!!confirmPassword && confirmPassword !== newPassword} />
                      {passwordToggle(showConfirmPassword, setShowConfirmPassword)}
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && <span className="st-error">Doesn&apos;t match yet.</span>}
                  </div>
                </div>

                {newPassword && (
                  <div className="st-strength">
                    <div className="st-strength-head">
                      <span>Strength</span>
                      <strong style={{ color: getStrengthColor(strengthDetails.score) }}>{getStrengthLabel(strengthDetails.score)}</strong>
                    </div>
                    <div className="st-strength-bar">
                      <span style={{ width: `${(strengthDetails.score / 5) * 100}%`, background: getStrengthColor(strengthDetails.score) }} />
                    </div>
                    <ul className="st-criteria">
                      {criteriaList.map((c) => (
                        <li key={c.key} className={strengthDetails.criteria[c.key] ? "met" : ""}>
                          {strengthDetails.criteria[c.key] ? <Check size={14} /> : <span className="st-criteria-dot" />}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <InlineNotice notice={passwordNotice} />

                <div className="st-actions">
                  <span className="st-hint">You&apos;ll use the new password from your next sign-in.</span>
                  <button className="btn btn-primary" type="submit" disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}>
                    {savingPassword ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            </section>

            {/* ── Two-factor ── */}
            <section id="two-factor" className="st-card" aria-labelledby="st-2fa">
              <div className="st-card-head">
                <span className="st-card-icon"><Smartphone size={18} /></span>
                <div>
                  <h2 id="st-2fa">Two-factor authentication</h2>
                  <p>Ask for a code from your authenticator app at sign-in, so a stolen password alone isn&apos;t enough.</p>
                </div>
              </div>

              <div className="st-row st-row-top">
                <div className="st-row-text">
                  <span className={`twofa-badge ${twoFactorEnabled ? "on" : "off"}`}>
                    {twoFactorEnabled ? <ShieldCheck size={15} /> : <Lock size={15} />}
                    {twoFactorEnabled === null ? "Checking…" : twoFactorEnabled ? "On" : "Off"}
                  </span>
                  <span>
                    {twoFactorEnabled
                      ? "Your account asks for a 6-digit code at sign-in."
                      : "Works with Google Authenticator, Authy, 1Password and similar apps."}
                  </span>
                </div>
                <div className="st-row-actions">
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
              </div>

              {twoFactorSetup && (
                <div className="st-2fa-enroll">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={twoFactorSetup.qr} alt="QR code for your authenticator app" width={180} height={180} />
                  <div className="st-2fa-steps">
                    <ol>
                      <li>Scan the QR code with your authenticator app.</li>
                      <li>Type the 6-digit code it shows.</li>
                    </ol>
                    <p className="st-hint">Can&apos;t scan? Enter this key: <code>{twoFactorSetup.secret}</code></p>
                    <div className="st-code-row">
                      <input className="st-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
                        value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))} aria-label="6-digit code" />
                      <button type="button" className="btn btn-primary btn-icon-gap" onClick={confirmTwoFactor} disabled={twoFactorBusy || twoFactorCode.length !== 6}>
                        {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : <Check size={16} />}
                        <span>Verify</span>
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(""); setTwoFactorNotice(null); }} disabled={twoFactorBusy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {disabling2fa && (
                <div className="st-code-row st-code-row-pad">
                  <input className="st-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Current code"
                    value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))} aria-label="Current 6-digit code" />
                  <button type="button" className="btn btn-primary" onClick={disableTwoFactor} disabled={twoFactorBusy || twoFactorCode.length !== 6}>
                    {twoFactorBusy ? <RefreshCw className="spin" size={15} /> : "Turn off"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setDisabling2fa(false); setTwoFactorCode(""); }} disabled={twoFactorBusy}>
                    Cancel
                  </button>
                </div>
              )}

              <InlineNotice notice={twoFactorNotice} />
            </section>

            {/* ── Appearance ── */}
            <section id="appearance" className="st-card" aria-labelledby="st-appearance">
              <div className="st-card-head">
                <span className="st-card-icon"><Palette size={18} /></span>
                <div>
                  <h2 id="st-appearance">Appearance</h2>
                  <p>Changes apply straight away on this device.</p>
                </div>
              </div>

              <div className="st-group">
                <span className="st-group-label">Theme</span>
                <div className="st-choices st-choices-2" role="radiogroup" aria-label="Theme">
                  {(["light", "dark"] as const).map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={theme === t} className={`st-choice ${theme === t ? "active" : ""}`} onClick={() => handleThemeChange(t)}>
                      <span className={`st-theme-mock ${t}`}><span /><span><i /><i /><i /></span></span>
                      <span className="st-choice-label">{t === "light" ? "Light" : "Dark"}{theme === t && <CheckCircle2 size={16} />}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="st-group">
                <span className="st-group-label">Text size</span>
                <div className="st-segment" role="radiogroup" aria-label="Text size">
                  {(["small", "medium", "large"] as const).map((sz) => (
                    <button type="button" key={sz} role="radio" aria-checked={fontSize === sz} className={fontSize === sz ? "active" : ""} onClick={() => setFontSize(sz)}>
                      <Type size={sz === "small" ? 13 : sz === "medium" ? 16 : 19} />
                      <span>{sz[0].toUpperCase() + sz.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="st-group">
                <span className="st-group-label">Data-entry layout</span>
                <div className="st-choices st-choices-3" role="radiogroup" aria-label="Data-entry layout">
                  {([
                    ["excel", <FileSpreadsheet key="i" size={16} />, "Excel", "The paper logbook as a sheet, with cell letters and a formula bar."],
                    ["spreadsheet", <Table2 key="i" size={16} />, "Spreadsheet", "All fields in one compact grid. Fastest for routine entries."],
                    ["cards", <LayoutList key="i" size={16} />, "Vertical", "One field per line. Easiest to read on small screens."],
                  ] as const).map(([value, icon, title, desc]) => (
                    <button key={value} type="button" role="radio" aria-checked={formLayout === value} className={`st-choice st-choice-row ${formLayout === value ? "active" : ""}`} onClick={() => setFormLayout(value)}>
                      <span className="st-choice-icon">{icon}</span>
                      <span className="st-choice-text"><strong>{title}</strong><small>{desc}</small></span>
                      {formLayout === value && <CheckCircle2 size={16} className="st-choice-check" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
