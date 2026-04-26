"use client";
import { useState } from "react";
import { EvaluateLiveStream } from "@/components/EvaluateLiveStream";

export default function EvaluatePage() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  return (
    <div style={{ padding: 24 }}>
      <h1 className="title">Evaluate a job posting</h1>
      <p className="lede">Paste a URL. The agent will evaluate it and stream progress here.</p>
      {!running ? (
        <form onSubmit={e => { e.preventDefault(); setRunning(url); }} style={{ marginTop: 24, display: "flex", gap: 12 }}>
          <input type="url" required value={url}
                 placeholder="https://company.com/careers/role"
                 onChange={e => setUrl(e.target.value)}
                 style={{
                   flex: 1, maxWidth: 480,
                   padding: "8px 12px", borderRadius: 5,
                   border: "1px solid var(--line)", background: "var(--bg-deep)", color: "var(--ink)",
                   fontFamily: "inherit", fontSize: 14,
                 }} />
          <button className="btn primary" type="submit">Run evaluation</button>
        </form>
      ) : (
        <EvaluateLiveStream url={running} />
      )}
    </div>
  );
}
