"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ScanEvent, ScanPosting } from "@/lib/types";
import { ScanResults } from "./ScanResults";

interface InitialLastRun {
  id: string;
  status: "running" | "complete" | "failed";
  startedAt: number;
  finishedAt: number | null;
  newPostings: ScanPosting[];
  errorMsg: string | null;
}

interface PortalSummary {
  enabledCount: number;
  totalCount: number;
  apiTypes: string[];
  matchableCount: number;
}

type Phase =
  | { kind: "idle" }
  | { kind: "running"; runId: string | null; logs: string[]; startedAt: number }
  | { kind: "complete"; runId: string; results: ScanPosting[]; logs: string[]; durationMs: number }
  | { kind: "failed"; runId: string | null; logs: string[]; error: string };

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export function ScanInterface({
  initialLastRun,
  portals,
}: {
  initialLastRun: InitialLastRun | null;
  portals: PortalSummary;
}) {
  const initialPhase: Phase = (() => {
    if (!initialLastRun) return { kind: "idle" };
    if (initialLastRun.status === "running") {
      return {
        kind: "running",
        runId: initialLastRun.id,
        logs: [],
        startedAt: initialLastRun.startedAt,
      };
    }
    if (initialLastRun.status === "complete") {
      return {
        kind: "complete",
        runId: initialLastRun.id,
        results: initialLastRun.newPostings,
        logs: [],
        durationMs: (initialLastRun.finishedAt ?? Date.now()) - initialLastRun.startedAt,
      };
    }
    return {
      kind: "failed",
      runId: initialLastRun.id,
      logs: [],
      error: initialLastRun.errorMsg ?? "Scan failed",
    };
  })();

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [lastRunStartedAt, setLastRunStartedAt] = useState<number | null>(
    initialLastRun?.startedAt ?? null,
  );
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Tick elapsed time during a run
  useEffect(() => {
    if (phase.kind !== "running") return;
    const startedAt = phase.startedAt;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [phase]);

  // Poll for an externally-triggered running scan when we're idle. If one
  // appears, we don't reconnect SSE but we do show the running indicator.
  useEffect(() => {
    if (phase.kind === "running") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/scan/runs?status=running&limit=1", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json() as { runs: Array<{ id: string; startedAt: number }> };
        const live = data.runs[0];
        if (live && !cancelled) {
          setPhase({
            kind: "running",
            runId: live.id,
            logs: [],
            startedAt: live.startedAt,
          });
        }
      } catch { /* ignore */ }
    };
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [phase.kind]);

  async function handleScan() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const startedAt = Date.now();
    setPhase({ kind: "running", runId: null, logs: [], startedAt });
    setElapsed(0);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (res.status === 409) {
        setPhase({
          kind: "failed",
          runId: null,
          logs: [],
          error: "A scan is already running. Wait for it to complete.",
        });
        return;
      }
      if (!res.ok || !res.body) {
        setPhase({
          kind: "failed",
          runId: null,
          logs: [],
          error: `HTTP ${res.status}`,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let runId: string | null = null;
      const logs: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, nl); buf = buf.slice(nl + 2);
          if (!chunk.startsWith("data: ")) continue;
          const payload = chunk.slice(6);
          if (payload === "[DONE]") return;
          const ev: ScanEvent = JSON.parse(payload);
          if (ev.type === "started") {
            runId = ev.runId;
            setPhase({ kind: "running", runId, logs: [...logs], startedAt });
          } else if (ev.type === "log") {
            logs.push(ev.line);
            // Keep last 50 lines for the live tail
            const tail = logs.slice(-50);
            setPhase({ kind: "running", runId, logs: tail, startedAt });
          } else if (ev.type === "done") {
            setPhase({
              kind: "complete",
              runId: runId ?? ev.runId,
              results: ev.newPostings,
              logs: logs.slice(-50),
              durationMs: Date.now() - startedAt,
            });
            setLastRunStartedAt(startedAt);
          } else if (ev.type === "error") {
            setPhase({
              kind: "failed",
              runId,
              logs: logs.slice(-50),
              error: ev.message,
            });
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setPhase({
        kind: "failed",
        runId: null,
        logs: [],
        error: (e as Error).message,
      });
    }
  }

  const scanRunning = phase.kind === "running";

  return (
    <div className="scan-shell">
      <div className="head">
        <h1 className="title">Scan portals for new postings</h1>
        <p className="lede">
          Hits Greenhouse, Ashby, and Lever APIs directly. Zero LLM tokens. Click and watch.
        </p>
      </div>

      <div className="scan-controls">
        <button
          className="btn primary"
          onClick={handleScan}
          disabled={scanRunning}
        >
          {scanRunning ? "Scanning…" : "Scan now"}
        </button>

        <div className="scan-meta">
          <div className="scan-meta-row">
            <span className="scan-meta-label">Last scan</span>
            <span className="scan-meta-value">
              {lastRunStartedAt ? formatRelative(lastRunStartedAt) : "Never"}
            </span>
          </div>
          <div className="scan-meta-row">
            <span className="scan-meta-label">Portals</span>
            <span className="scan-meta-value">
              {portals.matchableCount} of {portals.enabledCount}
              {portals.apiTypes.length > 0 && <> · {portals.apiTypes.join(" / ")}</>}
            </span>
          </div>
        </div>

        <Link href="/runs" className="btn ghost">All runs →</Link>
      </div>

      {portals.matchableCount === 0 && (
        <div className="scan-warning">
          <strong>Nothing to scan.</strong> No companies in <code>portals.yml</code> have a
          recognized Greenhouse, Ashby, or Lever URL. Add an explicit <code>api:</code> field
          or update <code>careers_url</code> to one of those portals.
        </div>
      )}

      {phase.kind === "running" && (
        <div className="scan-stream">
          <div className="scan-stream-head">
            <span>Scanning… {formatDuration(elapsed)}</span>
          </div>
          <pre className="log-tail">
            {phase.logs.length === 0 ? "(waiting for output…)" : phase.logs.join("\n")}
          </pre>
        </div>
      )}

      {phase.kind === "complete" && (
        <ScanResults
          results={phase.results}
          durationMs={phase.durationMs}
        />
      )}

      {phase.kind === "failed" && (
        <div className="scan-error">
          <strong>Scan failed.</strong>
          <p>{phase.error}</p>
          {phase.logs.length > 0 && (
            <pre className="log-tail">{phase.logs.join("\n")}</pre>
          )}
        </div>
      )}
    </div>
  );
}
