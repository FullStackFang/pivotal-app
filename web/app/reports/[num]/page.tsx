import Link from "next/link";
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
    <div className="report-page">
      <div className="report-meta">
        <Link href="/" className="report-back">← Pipeline</Link>
        <div className="report-id">Report · #{String(report.num).padStart(3, "0")}</div>
        {report.legitimacy && <span className="report-legit">{report.legitimacy}</span>}
        {report.url && (
          <a href={report.url} target="_blank" rel="noreferrer" className="report-url">
            Source ↗
          </a>
        )}
      </div>
      <article className="markdown report-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.bodyMd}</ReactMarkdown>
      </article>
    </div>
  );
}
