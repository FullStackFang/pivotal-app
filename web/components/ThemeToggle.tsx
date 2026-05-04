"use client";
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(STORAGE_KEY);
  if (t === "light" || t === "dark") return t;
  return "system";
}

function applyTheme(t: Theme) {
  const html = document.documentElement;
  if (t === "system") {
    html.removeAttribute("data-theme");
    localStorage.removeItem(STORAGE_KEY);
  } else {
    html.setAttribute("data-theme", t);
    localStorage.setItem(STORAGE_KEY, t);
  }
}

const LABEL: Record<Theme, string> = { system: "SYS", light: "LIGHT", dark: "DARK" };

export function ThemeToggle() {
  // Initialize from the DOM attribute set by the no-flash bootstrap script,
  // not from localStorage directly — the bootstrap script is the authority
  // on what's on screen at first paint.
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const cycle = () => {
    const next = NEXT[theme];
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[theme]} — click to cycle`}
      title="Cycle theme: system → light → dark"
      data-theme-state={theme}
    >
      <span className="theme-toggle-glyph" aria-hidden>
        {theme === "system" ? "◐" : theme === "light" ? "☼" : "☾"}
      </span>
      <span className="theme-toggle-label">{LABEL[theme]}</span>
    </button>
  );
}

// Re-export for callers that want to read/write programmatically.
export { ORDER as THEME_ORDER, type Theme };
