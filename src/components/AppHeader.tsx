"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, ScrollText, Settings, X } from "lucide-react";
import type { AppUser } from "@/lib/logbook";
import { LabLogo } from "./LabLogo";
import { ModalShell } from "./ModalShell";
import { ThemeToggle } from "./ThemeToggle";
import { UserAvatar } from "./UserAvatar";

// One header for every signed-in page: the same links on desktop and, below
// 900px, the same links in a slide-out menu. Replaces the old side rail that
// turned into a bottom bar on phones.

// replace() so Back doesn't return to the signed-in page.
function toLogin(reason: "signed-out" | "expired") {
  const here = window.location.pathname + window.location.search;
  const params = new URLSearchParams({ reason });
  if (reason === "expired" && here !== "/") params.set("redirect", here);
  window.location.replace(`/login?${params}`);
}

export type HeaderAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  badge?: number;
  badgeTone?: "danger";
};

type NavItem = { href: string; label: string; icon: ReactNode; badge?: number; badgeTone?: "danger" };

export function AppHeader({ user, actions = [], confirmLeave }: {
  user: AppUser | null;
  /** Page-specific buttons shown beside the main links (e.g. "My logs"). */
  actions?: HeaderAction[];
  /** Return false to cancel navigation (e.g. unsaved work). */
  confirmLeave?: () => boolean;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, rejected: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin";

  // Any page showing this header needs a live session. Check on load, when the
  // tab comes back into view, and when the browser restores the page from its
  // back/forward cache after a sign-out. Only a definite 401 redirects, so a
  // network blip doesn't throw someone out mid-entry.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => { if (!cancelled && r.status === 401) toLogin("expired"); })
        .catch(() => {});
    };
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) check(); };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    check();
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/logbook/review")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCounts({ pending: d.pending || 0, rejected: d.rejected || 0 }); })
      .catch(() => {});
  }, [user]);

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const nav: NavItem[] = [
    { href: "/", label: "Log entry", icon: <Activity size={18} /> },
    { href: "/logs", label: "My logs", icon: <ScrollText size={18} />, badge: isAdmin ? 0 : counts.rejected, badgeTone: "danger" },
    { href: "/weekly-plan", label: "Weekly plan", icon: <CalendarDays size={18} /> },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: <LayoutDashboard size={18} />, badge: counts.pending }] : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  function guard(e: React.MouseEvent) {
    if (confirmLeave && !confirmLeave()) { e.preventDefault(); return; }
    setDrawerOpen(false);
    setMenuOpen(false);
  }

  async function logout() {
    if (confirmLeave && !confirmLeave()) return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    toLogin("signed-out");
  }

  const badge = (n?: number, tone?: "danger") =>
    n ? <span className={`count-badge ${tone === "danger" ? "danger" : ""}`}>{n > 99 ? "99+" : n}</span> : null;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {user && (
          <button className="app-header-burger" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}>
            <Menu size={22} />
          </button>
        )}

        <Link href="/" className="app-header-brand" onClick={guard}>
          <LabLogo size={30} />
          <span>Lab Logbook</span>
        </Link>

        {user && (
          <nav className="app-header-nav" aria-label="Main">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={guard} className={`app-nav-link ${isActive(item.href) ? "active" : ""}`} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.icon}<span>{item.label}</span>{badge(item.badge, item.badgeTone)}
              </Link>
            ))}
            {actions.map((a) => (
              <button key={a.label} type="button" className="app-nav-link" onClick={a.onClick}>
                {a.icon}<span>{a.label}</span>{badge(a.badge, a.badgeTone)}
              </button>
            ))}
          </nav>
        )}

        <div className="app-header-end">
          <ThemeToggle variant="chip" />
          {user ? (
            <div className="app-account" ref={menuRef}>
              <button type="button" className="app-account-btn" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
                <UserAvatar name={user.username} seed={user.avatarSeed} size="sm" clickable={false} />
                <span className="app-account-name">{user.username}</span>
                <ChevronDown size={14} className={`dropdown-caret ${menuOpen ? "open" : ""}`} />
              </button>
              {menuOpen && (
                <div className="app-account-menu" role="menu">
                  <div className="app-account-info">
                    <strong>{user.fullName}</strong>
                    <span>{user.email}</span>
                    <span className="user-role-badge">{user.role}</span>
                  </div>
                  <Link href="/settings" role="menuitem" onClick={guard}><Settings size={16} /> Settings</Link>
                  <button type="button" role="menuitem" onClick={logout}><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <Link className="btn btn-primary btn-sm" href={`/login?redirect=${encodeURIComponent(pathname)}`}>Sign in</Link>
          )}
        </div>
      </div>

      {user && drawerOpen && (
        <ModalShell open onClose={() => setDrawerOpen(false)} overlayClassName="app-drawer-overlay" className="app-drawer" label="Menu">
          <div className="app-drawer-head">
            <div className="app-drawer-user">
              <UserAvatar name={user.username} seed={user.avatarSeed} size="md" clickable={false} />
              <div>
                <strong>{user.fullName}</strong>
                <span>@{user.username} · {user.role}</span>
              </div>
            </div>
            <button type="button" className="app-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={20} /></button>
          </div>
          <nav className="app-drawer-nav" aria-label="Main">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={guard} className={`app-drawer-link ${isActive(item.href) ? "active" : ""}`} aria-current={isActive(item.href) ? "page" : undefined}>
                {item.icon}<span>{item.label}</span>{badge(item.badge, item.badgeTone)}
              </Link>
            ))}
            {actions.map((a) => (
              <button key={a.label} type="button" className="app-drawer-link" onClick={() => { setDrawerOpen(false); a.onClick(); }}>
                {a.icon}<span>{a.label}</span>{badge(a.badge, a.badgeTone)}
              </button>
            ))}
          </nav>
          <div className="app-drawer-foot">
            <Link href="/settings" onClick={guard} className={`app-drawer-link ${isActive("/settings") ? "active" : ""}`}><Settings size={18} /><span>Settings</span></Link>
            <div className="app-drawer-theme"><span>Appearance</span><ThemeToggle variant="minimal" /></div>
            <button type="button" className="app-drawer-link" onClick={logout}><LogOut size={18} /><span>Sign out</span></button>
          </div>
        </ModalShell>
      )}
    </header>
  );
}
