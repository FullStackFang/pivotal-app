import { NextResponse } from "next/server";
import { listEvalRuns, type EvalRunStatus } from "@/lib/data/sqlite";
import { listLiveRuns } from "@/lib/agent/runner";

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
  const live = new Set(listLiveRuns());
  return NextResponse.json({
    runs: runs.map(r => ({
      ...r,
      // truth signal: even if status='running' in db, only `live=true` means
      // the subprocess is actually attached to this server process.
      live: live.has(r.id),
    })),
  });
}
