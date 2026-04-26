import Link from "next/link";
import { listApplications } from "@/lib/data/sqlite";

export default async function ReportsIndex() {
  const apps = listApplications({});
  const withReports = apps.filter(a => a.reportNum !== null);

  return (
    <div style={{ padding: 24 }}>
      <h1 className="title">Reports</h1>
      <p className="lede">All evaluated applications, newest first.</p>
      <ul style={{ marginTop: 24, listStyle: "none", padding: 0 }}>
        {withReports.map(a => (
          <li key={a.num} style={{ borderBottom: "1px solid var(--line-soft)", padding: "12px 0" }}>
            <Link href={`/reports/${a.reportNum}`} style={{ color: "var(--ink)", textDecoration: "none" }}>
              <span className="id">#{String(a.num).padStart(3, "0")}</span>
              {" · "}
              <strong>{a.company}</strong>
              {" — "}
              {a.role}
              {" · "}
              <span className="date">{a.date}</span>
              {a.score !== null && (
                <span style={{ marginLeft: 12, color: "var(--ink-3)" }}>{a.score.toFixed(1)}/5</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
