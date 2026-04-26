import { NextResponse } from "next/server";
import { listEvalRuns, listApplications, reportNumByUrl, type EvalRunStatus } from "@/lib/data/sqlite";
import { computeViewState, liveIdSet } from "@/lib/agent/runState";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = (statusParam === "running" || statusParam === "complete" || statusParam === "failed")
    ? (statusParam as EvalRunStatus)
    : undefined;
  const limit = url.searchParams.has("limit")
    ? parseInt(url.searchParams.get("limit")!, 10)
    : undefined;

  const runs = listEvalRuns({ status, limit });
  const live = liveIdSet();

  const appsByReportNum = new Map<number, { company: string; role: string; score: number | null }>();
  for (const a of listApplications({})) {
    if (a.reportNum !== null) {
      appsByReportNum.set(a.reportNum, { company: a.company, role: a.role, score: a.score });
    }
  }
  // URL fallback: when result_num wasn't captured (the runner's stdout
  // parser missed the agent's "Filed:" output format), match runs to
  // reports via the URL recorded inside the report itself.
  const urlToReportNum = reportNumByUrl();

  return NextResponse.json({
    runs: runs.map(r => {
      const viewState = computeViewState(r, live);
      const reportNum = r.resultNum ?? urlToReportNum.get(r.url) ?? null;
      const app = reportNum !== null ? appsByReportNum.get(reportNum) : undefined;
      return {
        ...r,
        // surface the resolved report num so the UI can link to it
        resultNum: reportNum,
        viewState,
        live: viewState === "attached",
        company: app?.company ?? null,
        role: app?.role ?? null,
        score: app?.score ?? null,
      };
    }),
  });
}
