"use client";
import { useEffect, useRef, useState } from "react";
import type { EvalEvent } from "@/lib/types";
import { useRouter } from "next/navigation";

export function EvaluateLiveStream({ url }: { url: string }) {
  const [progress, setProgress] = useState<{ block: number; total: number; label: string } | null>(null);
  const [logTail, setLogTail] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; startedRef.current = true;

    (async () => {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.body) { setError("No response body"); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
          const ev: EvalEvent = JSON.parse(payload);
          if (ev.type === "progress") setProgress({ block: ev.block, total: ev.total, label: ev.label });
          if (ev.type === "log") setLogTail(t => [...t.slice(-9), ev.line]);
          if (ev.type === "error") setError(ev.message);
          if (ev.type === "report-written") router.push(`/reports/${ev.num}`);
        }
      }
    })();
  }, [url, router]);

  return (
    <div className="evaluate-live">
      <h2>Evaluating <code>{url}</code></h2>
      {progress && <p>Block {progress.block} / {progress.total} · {progress.label}</p>}
      <div className="progress-bar" />
      <pre className="log-tail">{logTail.join("\n")}</pre>
      {error && <p className="error">Error: {error}</p>}
    </div>
  );
}
