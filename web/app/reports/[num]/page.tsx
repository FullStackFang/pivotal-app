import { getReport } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";
import { notFound } from "next/navigation";
import { parseReport } from "@/lib/data/reportParser";
import { ReportHero } from "@/components/ReportHero";
import { ReportTOC } from "@/components/ReportTOC";
import { ReportContent } from "@/components/ReportContent";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ num: string }> }) {
  fullIndex();
  const { num } = await params;
  const report = getReport(parseInt(num, 10));
  if (!report) notFound();

  const parsed = parseReport(report);

  return (
    <div className="report-page">
      <ReportHero parsed={parsed} num={report.num} />
      <div className="report-shell">
        <ReportTOC parsed={parsed} />
        <ReportContent body={parsed.body} />
      </div>
    </div>
  );
}
