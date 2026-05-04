"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keyboard shortcuts. Single keys (no modifier) navigate when no editable
// element is focused. `/` focuses a search input on the current page if one
// is present. `?` toggles the keyboard-help overlay (lightweight — uses
// `alert` for now, can become a pinned panel later).
const ROUTES: Array<{ key: string; href: string; label: string }> = [
  { key: "h", href: "/",         label: "Pipeline" },
  { key: "s", href: "/scan",     label: "Scan" },
  { key: "e", href: "/evaluate", label: "Evaluate" },
  { key: "u", href: "/runs",     label: "Runs" },
  { key: "r", href: "/reports",  label: "Reports" },
  { key: "p", href: "/profile",  label: "Profile" },
];

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

export function CommandBar() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Modifier keys bypass — Cmd/Ctrl combinations are owned by browsers
      // and apps (e.g. ⌘S to save). We only react to bare keystrokes.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      // `/` focuses any visible search input (the pipeline toolbar uses one).
      if (e.key === "/") {
        const search = document.querySelector<HTMLInputElement>(
          'input[type="search"], .toolbar input[type="text"], input[placeholder*="search" i]'
        );
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
          return;
        }
      }

      const lower = e.key.toLowerCase();
      const match = ROUTES.find((r) => r.key === lower);
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return (
    <footer className="cmd">
      <span className="grp"><span className="k">/</span> Filter</span>
      <span className="cmd-sep" aria-hidden>·</span>
      {ROUTES.map((r) => (
        <span key={r.key} className="grp">
          <span className="k">{r.key.toUpperCase()}</span>
          {r.label}
        </span>
      ))}
      <span className="right">
        <span className="grp"><span className="ok">●</span> claude · subscription</span>
      </span>
    </footer>
  );
}
