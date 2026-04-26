import Link from "next/link";
import { listEvalRuns } from "@/lib/data/sqlite";
import { listLiveRuns } from "@/lib/agent/runner";

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 5)    return "just now";
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function duration(startedAt: number, finishedAt: number | null): string {
  if (!finishedAt) return "—";
  const ms = finishedAt - startedAt;
  if (ms < 1000)         return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60)            return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 30) + "…" : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url.length > 50 ? url.slice(0, 50) + "…" : url;
  }
}

export default async function RunsPage() {
  const runs = listEvalRuns({});
  const live = new Set(listLiveRuns());

  const liveCount = runs.filter(r => r.status === "running" && live.has(r.id)).length;

  return (
    <div className="runs-page">
      <div className="head">
        <h1 className="title">
          Evaluation runs
          {liveCount > 0 && <em> · {liveCount} live</em>}
        </h1>
        <p className="lede">
          Every evaluation the agent has spawned. Live runs are still attached to the current server.
        </p>
      </div>
      <div className="table-wrap">
        {runs.length === 0 ? (
          <div className="empty-state">
            <h3>No runs yet</h3>
            <p>Paste a job URL on Evaluate to spawn the first one.</p>
          </div>
        ) : (
          <table className="apps">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Status</th>
                <th>URL</th>
                <th style={{ width: 130 }}>Started</th>
                <th style={{ width: 90 }}>Duration</th>
                <th style={{ width: 100 }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => {
                const stale = r.status === "running" && !live.has(r.id);
                const displayStatus = stale ? "stale" : r.status;
                const cls =
                  displayStatus === "complete" ? "s-interview" :
                  displayStatus === "failed"   ? "s-rejected" :
                  displayStatus === "stale"    ? "s-skip" :
                                                 "s-applied"; // running
                return (
                  <tr key={r.id}>
                    <td>
                      <span className={`status ${cls}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td>
                      <a href={r.url} target="_blank" rel="noreferrer" className="role">
                        {shortUrl(r.url)}
                      </a>
                    </td>
                    <td className="date">{relativeTime(r.startedAt)}</td>
                    <td className="date">{duration(r.startedAt, r.finishedAt)}</td>
                    <td>
                      {r.resultNum
                        ? <Link href={`/reports/${r.resultNum}`} className="report-link">#{String(r.resultNum).padStart(3, "0")}</Link>
                        : r.errorMsg
                          ? <span className="run-err" title={r.errorMsg}>error</span>
                          : <span className="date">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
