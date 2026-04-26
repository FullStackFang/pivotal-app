"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NavRail({ counts }: { counts: { pipeline: number } }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [liveRuns, setLiveRuns] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/runs?status=running");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setLiveRuns(
            data.runs.filter((r: { viewState?: string; live?: boolean }) =>
              r.viewState === "attached" || r.viewState === "orphan-alive" || r.live
            ).length
          );
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const item = (label: string, href: string, badge?: string, badgeKind?: "muted" | "live") => (
    <Link key={href} href={href} className={`rail-link ${isActive(href) ? "is-active" : ""}`}>
      <span>{label}</span>
      {badge && <span className={`badge ${badgeKind === "live" ? "badge-live" : ""}`}>{badge}</span>}
    </Link>
  );

  return (
    <nav className="rail">
      <div className="group"><h6>Workspace</h6></div>
      {item("Pipeline",     "/",         String(counts.pipeline))}
      {item("Evaluate URL", "/evaluate")}
      {item("Runs",         "/runs",     liveRuns > 0 ? String(liveRuns) : undefined, liveRuns > 0 ? "live" : "muted")}
      {item("Reports",      "/reports")}
    </nav>
  );
}
