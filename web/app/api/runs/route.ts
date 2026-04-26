import { NextResponse } from "next/server";
import { listEvalRuns, type EvalRunStatus } from "@/lib/data/sqlite";
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
  return NextResponse.json({
    runs: runs.map(r => {
      const viewState = computeViewState(r, live);
      return {
        ...r,
        viewState,
        live: viewState === "attached", // backward compat
      };
    }),
  });
}
