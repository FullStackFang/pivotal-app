import type { Application, Report } from "@/lib/types";
import Link from "next/link";

export function DetailPanel({ app, report }: { app: Application | null; report: Report | null }) {
  if (!app) {
    return (
      <aside className="detail">
        <div className="dh"><p>Select a row to see the report.</p></div>
      </aside>
    );
  }
  return (
    <aside className="detail">
      <div className="dh">
        <div className="id-line">Report · #{String(app.num).padStart(3, "0")} · {app.date}</div>
        <h3>{app.role}</h3>
        <div className="at">at <b>{app.company}</b></div>
        {app.score !== null && (
          <div className="verdict">
            <div className="num">{app.score.toFixed(1)}<small>/ 5.0</small></div>
            <div className="verdict-body">
              <div className="rec">{app.score >= 4 ? "Recommend" : "Below threshold"}</div>
              <p>{app.notes || "No notes."}</p>
            </div>
          </div>
        )}
      </div>
      {report && (
        <div className="section">
          <h4>Score breakdown</h4>
          <div className="breakdown">
            {(["A","B","C","D","E","F","G"] as const).map(k => report.scores[k] !== undefined && (
              <div key={k} className="row">
                <div className="label">{k}</div>
                <div className="meter"><span style={{ width: `${(report.scores[k]! / 5) * 100}%` }} /></div>
                <div className="v">{report.scores[k]!.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="actions">
        <Link href={`/reports/${app.num}`} className="btn">Open report</Link>
      </div>
    </aside>
  );
}
