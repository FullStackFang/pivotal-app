"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ViewState = "attached" | "orphan-alive" | "orphan-dead" | "complete" | "failed";

export interface RunRow {
  id: string;
  url: string;
  status: "running" | "complete" | "failed";
  startedAt: number;
  finishedAt: number | null;
  resultNum: number | null;
  logPath: string;
  errorMsg: string | null;
  pid: number | null;
  viewState: ViewState;
  live: boolean;
  company: string | null;
  role: string | null;
  score: number | null;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function duration(startedAt: number, finishedAt: number | null): string {
  const end = finishedAt ?? Date.now();
  const ms = end - startedAt;
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname.length > 30 ? u.pathname.slice(0, 30) + "…" : u.pathname;
    return `${u.host}${p}`;
  } catch {
    return url.length > 50 ? url.slice(0, 50) + "…" : url;
  }
}

const PILL: Record<ViewState, { label: string; cls: string }> = {
  attached:       { label: "running",  cls: "s-applied" },
  "orphan-alive": { label: "orphan",   cls: "s-eval" },
  "orphan-dead":  { label: "stale",    cls: "s-skip" },
  complete:       { label: "complete", cls: "s-interview" },
  failed:         { label: "failed",   cls: "s-rejected" },
};

export function RunsTable({ initialRuns }: { initialRuns: RunRow[] }) {
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [pending, setPending] = useState<Map<string, "killing" | "rerunning">>(new Map());
  const [duplicateOf, setDuplicateOf] = useState<{ runId: string; existingRunId: string } | null>(null);

  // Poll for fresh state every 5s. Fire once immediately so newly-spawned
  // runs don't have to wait a full interval to appear.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/runs", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setRuns(data.runs);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const setRowPending = (runId: string, state: "killing" | "rerunning" | null) => {
    setPending(prev => {
      const next = new Map(prev);
      if (state) next.set(runId, state);
      else       next.delete(runId);
      return next;
    });
  };

  const onKill = async (runId: string) => {
    setRowPending(runId, "killing");
    try {
      await fetch(`/api/runs/${runId}/kill`, { method: "POST" });
      // Refresh after a beat so the user sees the new state quickly.
      setTimeout(async () => {
        const res = await fetch("/api/runs");
        if (res.ok) setRuns((await res.json()).runs);
      }, 600);
    } finally {
      setTimeout(() => setRowPending(runId, null), 1500);
    }
  };

  const onRerun = async (runId: string, force = false) => {
    setRowPending(runId, "rerunning");
    setDuplicateOf(null);
    try {
      const res = await fetch(`/api/runs/${runId}/rerun${force ? "?force=true" : ""}`, { method: "POST" });
      if (res.status === 409) {
        const data = await res.json();
        setDuplicateOf({ runId, existingRunId: data.existingRunId });
        return;
      }
      if (res.ok) {
        const refresh = await fetch("/api/runs");
        if (refresh.ok) setRuns((await refresh.json()).runs);
      }
    } finally {
      setRowPending(runId, null);
    }
  };

  const canKill   = (vs: ViewState) => vs === "attached" || vs === "orphan-alive";
  const canRerun  = (vs: ViewState) => vs === "complete"  || vs === "failed" || vs === "orphan-dead";

  if (runs.length === 0) {
    return (
      <div className="empty-state">
        <h3>No runs yet</h3>
        <p>Paste a job URL on Evaluate to spawn the first one.</p>
      </div>
    );
  }

  return (
    <table className="apps runs">
      <thead>
        <tr>
          <th style={{ width: 110 }}>Status</th>
          <th style={{ width: 200 }}>Company</th>
          <th>Role</th>
          <th style={{ width: 100 }}>Started</th>
          <th style={{ width: 80 }}>Duration</th>
          <th style={{ width: 80 }}>Result</th>
          <th style={{ width: 220, textAlign: "right" }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {runs.map(r => {
          const pill = PILL[r.viewState];
          const pendingState = pending.get(r.id);
          const isOpen = openLog === r.id;

          return (
            <Row
              key={r.id}
              row={r}
              pill={pill}
              isOpen={isOpen}
              pendingState={pendingState}
              duplicateOf={duplicateOf?.runId === r.id ? duplicateOf : null}
              onToggleLog={() => setOpenLog(isOpen ? null : r.id)}
              onKill={() => onKill(r.id)}
              onRerun={(force) => onRerun(r.id, force)}
              canKill={canKill(r.viewState)}
              canRerun={canRerun(r.viewState)}
              onDismissDup={() => setDuplicateOf(null)}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function Row({
  row, pill, isOpen, pendingState, duplicateOf, onToggleLog, onKill, onRerun,
  canKill, canRerun, onDismissDup,
}: {
  row: RunRow;
  pill: { label: string; cls: string };
  isOpen: boolean;
  pendingState: "killing" | "rerunning" | undefined;
  duplicateOf: { runId: string; existingRunId: string } | null;
  onToggleLog: () => void;
  onKill: () => void;
  onRerun: (force?: boolean) => void;
  canKill: boolean;
  canRerun: boolean;
  onDismissDup: () => void;
}) {
  return (
    <>
      <tr className={isOpen ? "is-selected" : ""}>
        <td>
          <span className={`status ${pill.cls}`}>{pill.label}</span>
        </td>
        <td>
          {row.company ? (
            <div className="run-company">
              <b>{row.company}</b>
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="run-url-mini"
                title={row.url}
              >↗</a>
            </div>
          ) : (
            <div className="run-company">
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                className="run-url-fallback"
                title={row.url}
              >
                {shortUrl(row.url)} ↗
              </a>
            </div>
          )}
        </td>
        <td className="run-role">
          {row.role ?? (
            <span className="run-pending">
              {row.viewState === "attached" || row.viewState === "orphan-alive"
                ? "evaluating…"
                : "no report produced"}
            </span>
          )}
        </td>
        <td className="date">{relativeTime(row.startedAt)}</td>
        <td className="date">{duration(row.startedAt, row.finishedAt)}</td>
        <td>
          {row.resultNum
            ? <Link href={`/reports/${row.resultNum}`} className="report-link">#{String(row.resultNum).padStart(3, "0")}</Link>
            : row.errorMsg
              ? <span className="run-err" title={row.errorMsg}>error</span>
              : <span className="date">—</span>}
        </td>
        <td className="run-actions">
          <button className="btn ghost" onClick={onToggleLog}>
            {isOpen ? "Hide log" : "Log"}
          </button>
          {canKill && (
            <button
              className="btn danger"
              onClick={onKill}
              disabled={pendingState === "killing"}
            >
              {pendingState === "killing" ? "Killing…" : "Kill"}
            </button>
          )}
          {canRerun && (
            <button
              className="btn"
              onClick={() => onRerun(false)}
              disabled={pendingState === "rerunning"}
            >
              {pendingState === "rerunning" ? "…" : "Re-run"}
            </button>
          )}
        </td>
      </tr>
      {duplicateOf && (
        <tr>
          <td colSpan={7} className="dup-banner">
            <span>
              A run for this URL is already active (
              <code>#{duplicateOf.existingRunId.slice(0, 8)}</code>).
            </span>
            <span className="dup-actions">
              <button className="btn primary" onClick={() => onRerun(true)}>Run anyway</button>
              <button className="btn ghost" onClick={onDismissDup}>Cancel</button>
            </span>
          </td>
        </tr>
      )}
      {isOpen && (
        <tr className="log-row">
          <td colSpan={7}>
            <LogDrawer run={row} />
          </td>
        </tr>
      )}
    </>
  );
}

function LogDrawer({ run }: { run: RunRow }) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLines([]);
    setError(null);
    const live = run.viewState === "attached" || run.viewState === "orphan-alive";

    if (live) {
      // SSE live tail.
      setStreaming(true);
      const es = new EventSource(`/api/runs/${run.id}/log/stream`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.line !== undefined && !cancelled) {
            setLines(prev => [...prev, data.line]);
          }
        } catch { /* */ }
      };
      es.addEventListener("run-ended", () => {
        setStreaming(false);
        es.close();
      });
      es.onerror = () => {
        setStreaming(false);
        es.close();
      };
      return () => { cancelled = true; es.close(); };
    }

    // Static fetch for finished runs.
    (async () => {
      try {
        const res = await fetch(`/api/runs/${run.id}/log?tail=200`);
        if (!res.ok) { setError("Failed to load log"); return; }
        const data = await res.json();
        if (!cancelled) setLines(data.lines);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [run.id, run.viewState]);

  // Auto-scroll while streaming.
  useEffect(() => {
    if (streaming && tailRef.current) {
      tailRef.current.scrollTop = tailRef.current.scrollHeight;
    }
  }, [lines, streaming]);

  return (
    <div className="log-drawer">
      <div className="log-meta">
        <span className="run-id">{run.id.slice(0, 8)}</span>
        {streaming
          ? <span className="streaming"><span className="pulse" /> tailing live</span>
          : <span className="static-tail">{lines.length} lines</span>}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="log-tail" ref={tailRef}>
        {lines.length === 0
          ? <span className="muted">— empty —</span>
          : lines.map((line, i) => <div key={i}>{line || " "}</div>)}
      </div>
    </div>
  );
}
