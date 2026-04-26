"use client";
import { useState } from "react";
import Link from "next/link";
import { EvaluateLiveStream } from "@/components/EvaluateLiveStream";

interface QueuedRun {
  key: string;
  url: string;
}

export default function EvaluatePage() {
  const [url, setUrl] = useState("");
  const [runs, setRuns] = useState<QueuedRun[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setRuns(prev => [...prev, { key: `${Date.now()}-${Math.random()}`, url }]);
    setUrl("");
  };

  return (
    <div className="evaluate-page">
      <div className="head">
        <h1 className="title">Evaluate a job posting</h1>
        <p className="lede">
          Paste a URL — the agent runs in the background.
          {runs.length > 0 && " Submit another while the first one streams."}
        </p>
      </div>

      <form onSubmit={submit} className="evaluate-form">
        <input
          type="url"
          required
          value={url}
          placeholder="https://company.com/careers/role"
          onChange={e => setUrl(e.target.value)}
        />
        <button className="btn primary" type="submit">Run evaluation</button>
        <Link href="/runs" className="btn ghost">All runs →</Link>
      </form>

      {runs.length === 0 ? (
        <p className="muted" style={{ padding: 24, color: "var(--ink-3)" }}>
          No runs in this tab yet. Live progress will appear below as you submit.
        </p>
      ) : (
        <div className="evaluate-streams">
          {runs.map(r => (
            <EvaluateLiveStream key={r.key} url={r.url} />
          ))}
        </div>
      )}
    </div>
  );
}
