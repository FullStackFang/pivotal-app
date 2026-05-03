"use client";
import { useState } from "react";
import Link from "next/link";
import type { ScanPosting } from "@/lib/types";

type EvalState = "idle" | "queueing" | "queued" | "error";

export function ScanResults({
  results,
  durationMs,
}: {
  results: ScanPosting[];
  durationMs: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [perRowState, setPerRowState] = useState<Map<string, EvalState>>(new Map());
  const [bulkState, setBulkState] = useState<EvalState>("idle");

  const toggle = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(r => r.url)));
  };

  const setRowState = (url: string, state: EvalState) => {
    setPerRowState(prev => {
      const next = new Map(prev);
      next.set(url, state);
      return next;
    });
  };

  async function evaluateOne(url: string): Promise<boolean> {
    setRowState(url, "queueing");
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      // We don't await the SSE stream — just confirm the request was accepted.
      // The /runs page will show the run live; the user can navigate there.
      if (res.ok || res.body) {
        setRowState(url, "queued");
        return true;
      }
      setRowState(url, "error");
      return false;
    } catch {
      setRowState(url, "error");
      return false;
    }
  }

  async function evaluateSelected() {
    setBulkState("queueing");
    const targets = Array.from(selected);
    let allOk = true;
    for (const url of targets) {
      const ok = await evaluateOne(url);
      if (!ok) allOk = false;
    }
    setBulkState(allOk ? "queued" : "error");
  }

  if (results.length === 0) {
    return (
      <div className="scan-results-empty">
        <h2>No new postings this scan.</h2>
        <p>Either nothing new was published, or every match was already in your pipeline.</p>
      </div>
    );
  }

  const selectAllChecked = selected.size === results.length;
  const someSelected = selected.size > 0;

  return (
    <div className="scan-results">
      <div className="scan-results-head">
        <h2>
          {results.length} new {results.length === 1 ? "posting" : "postings"} found
        </h2>
        <span className="muted">in {(durationMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="scan-results-actions">
        <button
          className="btn primary"
          onClick={evaluateSelected}
          disabled={!someSelected || bulkState === "queueing"}
        >
          {bulkState === "queueing"
            ? `Queueing ${selected.size}…`
            : bulkState === "queued"
              ? `Queued ${selected.size}`
              : `Evaluate ${selected.size || ""} selected`}
        </button>
        <button
          className="btn ghost"
          onClick={toggleAll}
        >
          {selectAllChecked ? "Clear selection" : "Select all"}
        </button>
        <Link href="/runs" className="btn ghost">View runs →</Link>
      </div>

      <div className="scan-results-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={selectAllChecked}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th>Company</th>
              <th>Role</th>
              <th style={{ width: 130 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const state = perRowState.get(r.url) ?? "idle";
              return (
                <tr key={r.url}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.url)}
                      onChange={() => toggle(r.url)}
                      aria-label={`Select ${r.title}`}
                    />
                  </td>
                  <td>{r.company}</td>
                  <td>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                  </td>
                  <td>
                    <button
                      className={`btn small ${state === "queued" ? "ghost" : ""}`}
                      onClick={() => evaluateOne(r.url)}
                      disabled={state === "queueing" || state === "queued"}
                    >
                      {state === "queueing" ? "Queueing…"
                        : state === "queued" ? "Queued ✓"
                        : state === "error" ? "Retry"
                        : "Evaluate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
