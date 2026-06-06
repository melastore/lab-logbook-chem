"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Theme = "light" | "dark";
type FontSize = "small" | "medium" | "large";
type FormLayout = "spreadsheet" | "cards";

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  formLayout: FormLayout;
  setFormLayout: (l: FormLayout) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Use lazy initializer to read from localStorage immediately on first render in browser
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lab-theme") as Theme;
      if (saved === "light" || saved === "dark") return saved;
    }
    return "light";
  });

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lab-font-size") as FontSize;
      if (saved === "small" || saved === "medium" || saved === "large") return saved;
    }
    return "medium";
  });

  const [formLayout, setFormLayoutState] = useState<FormLayout>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lab-form-layout") as FormLayout;
      if (saved === "spreadsheet" || saved === "cards") return saved;
    }
    return "spreadsheet";
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("lab-theme", t);
      document.documentElement.dataset.theme = t;
    }
  };

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    if (typeof window !== "undefined") {
      localStorage.setItem("lab-font-size", s);
      document.documentElement.dataset.fontSize = s;
    }
  };

  const setFormLayout = (l: FormLayout) => {
    setFormLayoutState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("lab-form-layout", l);
    }
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, fontSize, setFontSize, formLayout, setFormLayout }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
