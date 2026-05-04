"use client";
import { useEffect, useState } from "react";

type Status =
  | { kind: "ready" }
  | { kind: "running"; count: number }
  | { kind: "scanning" };

export function TopbarLive() {
  const [status, setStatus] = useState<Status>({ kind: "ready" });

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [runsRes, scanRes] = await Promise.all([
          fetch("/api/runs?status=running"),
          fetch("/api/scan/runs?status=running&limit=1"),
        ]);
        if (cancelled) return;
        let runningCount = 0;
        if (runsRes.ok) {
          const data = await runsRes.json();
          runningCount = data.runs.filter(
            (r: { viewState?: string; live?: boolean }) =>
              r.viewState === "attached" || r.viewState === "orphan-alive" || r.live,
          ).length;
        }
        let scanRunning = false;
        if (scanRes.ok) {
          const data = await scanRes.json();
          scanRunning = data.runs.length > 0;
        }
        if (runningCount > 0) setStatus({ kind: "running", count: runningCount });
        else if (scanRunning) setStatus({ kind: "scanning" });
        else setStatus({ kind: "ready" });
      } catch {
        /* ignore — keep last status */
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (status.kind === "running") {
    return (
      <div className="stat live" title={`${status.count} evaluation run${status.count === 1 ? "" : "s"} in progress`}>
        <span className="pulse" /> RUNNING <b className="num">{status.count}</b>
      </div>
    );
  }
  if (status.kind === "scanning") {
    return (
      <div className="stat live" title="Portal scan in progress">
        <span className="pulse" /> SCANNING
      </div>
    );
  }
  return (
    <div className="stat live stat-ready" title="No active runs">
      <span className="pulse pulse-quiet" /> READY
    </div>
  );
}
