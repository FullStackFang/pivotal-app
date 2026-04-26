import { getReport } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";

export default async function ReportPage({ params }: { params: Promise<{ num: string }> }) {
  fullIndex();
  const { num } = await params;
  const report = getReport(parseInt(num, 10));
  if (!report) notFound();

  return (
    <div style={{ padding: 24, maxWidth: 880, overflow: "auto" }}>
      <div className="id-line" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        Report · #{String(report.num).padStart(3, "0")}
      </div>
      {report.url && (
        <p style={{ marginTop: 12 }}>
          <a href={report.url} target="_blank" rel="noreferrer" style={{ color: "var(--ember)" }}>
            {report.url}
          </a>
        </p>
      )}
      {report.legitimacy && (
        <p>
          Legitimacy: <strong>{report.legitimacy}</strong>
        </p>
      )}
      <article className="markdown" style={{ marginTop: 24 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.bodyMd}</ReactMarkdown>
      </article>
    </div>
  );
}
