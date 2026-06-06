"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
type Variant = "rail" | "floating" | "chip" | "minimal";

function readTheme(): Theme {
  if (typeof document !== "undefined") {
    const current = document.documentElement.dataset.theme;
    if (current === "dark" || current === "light") return current;
  }
  return "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* storage unavailable — ignore */
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

/** Subscribe to the active theme; keeps multiple toggles in sync. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Sync from the DOM after hydration: the real theme is applied pre-paint by an
    // inline script in layout.tsx, so SSR always renders the "light" default to
    // avoid a hydration mismatch, then we reconcile here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme());
    function onChange() {
      setTheme(readTheme());
    }
    window.addEventListener("themechange", onChange);
    return () => window.removeEventListener("themechange", onChange);
  }, []);

  return [theme, applyTheme];
}

export function ThemeToggle({ variant = "chip" }: { variant?: Variant }) {
  const [theme, setTheme] = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  const icon = isDark ? <SunIcon /> : <MoonIcon />;

  if (variant === "floating") {
    return (
      <button className="theme-toggle-float" type="button" onClick={toggle} aria-label={label} title={label}>
        {icon}
      </button>
    );
  }

  if (variant === "minimal") {
    return (
      <button 
        className="theme-toggle-minimal" 
        type="button" 
        onClick={toggle} 
        aria-label={label} 
        title={label}
        style={{
          padding: '4px 10px',
          borderRadius: '99px',
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          background: isDark ? 'var(--surface-3)' : '#ffffff',
          color: isDark ? 'var(--on-surface)' : '#000000',
          border: '1px solid var(--outline-variant)'
        }}
      >
        {isDark ? "White" : "Dark"}
      </button>
    );
  }

  if (variant === "rail") {
    return (
      <button className="rail-link" type="button" onClick={toggle} aria-label={label} title={label}>
        {icon}
        <span>{isDark ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <button className="btn btn-outline btn-sm theme-chip" type="button" onClick={toggle} aria-label={label} title={label}>
      {icon}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
