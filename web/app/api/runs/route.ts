import { NextResponse } from "next/server";
import { listEvalRuns, listApplications, type EvalRunStatus } from "@/lib/data/sqlite";
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

  // Build a lookup so we can attach the company / role for runs that
  // produced an application (i.e. have a result_num).
  const appsByReportNum = new Map<number, { company: string; role: string; score: number | null }>();
  for (const a of listApplications({})) {
    if (a.reportNum !== null) {
      appsByReportNum.set(a.reportNum, { company: a.company, role: a.role, score: a.score });
    }
  }

  return NextResponse.json({
    runs: runs.map(r => {
      const viewState = computeViewState(r, live);
      const app = r.resultNum !== null ? appsByReportNum.get(r.resultNum) : undefined;
      return {
        ...r,
        viewState,
        live: viewState === "attached", // backward compat
        company: app?.company ?? null,
        role: app?.role ?? null,
        score: app?.score ?? null,
      };
    }),
  });
}
