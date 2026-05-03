"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BadgeKind = "muted" | "live" | "warn";

export function NavRail({ counts }: { counts: { pipeline: number } }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [liveRuns, setLiveRuns] = useState(0);
  const [scanRunning, setScanRunning] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [runsRes, scanRes] = await Promise.all([
          fetch("/api/runs?status=running"),
          fetch("/api/scan/runs?status=running&limit=1"),
        ]);
        if (cancelled) return;
        if (runsRes.ok) {
          const data = await runsRes.json();
          setLiveRuns(
            data.runs.filter((r: { viewState?: string; live?: boolean }) =>
              r.viewState === "attached" || r.viewState === "orphan-alive" || r.live
            ).length
          );
        }
        if (scanRes.ok) {
          const data = await scanRes.json();
          setScanRunning(data.runs.length > 0);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const [setupNeeded, setSetupNeeded] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user-files", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { files: Array<{ exists: boolean; isPristine: boolean }> }) => {
        if (cancelled) return;
        setSetupNeeded(d.files.filter((f) => !f.exists || f.isPristine).length);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [pathname]);

  const item = (label: string, href: string, badge?: string, badgeKind?: BadgeKind) => (
    <Link key={href} href={href} className={`rail-link ${isActive(href) ? "is-active" : ""}`}>
      <span>{label}</span>
      {badge && (
        <span
          className={`badge ${badgeKind === "live" ? "badge-live" : ""} ${badgeKind === "warn" ? "badge-warn" : ""}`}
        >
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <nav className="rail">
      <div className="group"><h6>You</h6></div>
      {item(
        "Profile",
        "/profile",
        setupNeeded > 0 ? String(setupNeeded) : undefined,
        setupNeeded > 0 ? "warn" : "muted",
      )}
      <div className="group group-spaced"><h6>Workspace</h6></div>
      {item("Pipeline",     "/",         String(counts.pipeline))}
      {item("Scan",         "/scan",     scanRunning ? "•" : undefined, scanRunning ? "live" : "muted")}
      {item("Evaluate URL", "/evaluate")}
      {item("Runs",         "/runs",     liveRuns > 0 ? String(liveRuns) : undefined, liveRuns > 0 ? "live" : "muted")}
      {item("Reports",      "/reports")}
    </nav>
  );
}
