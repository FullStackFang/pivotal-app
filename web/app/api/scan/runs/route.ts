import { NextResponse } from "next/server";
import { listScanRuns, type ScanRunStatus } from "@/lib/data/sqlite";
import { listLiveScanRuns } from "@/lib/agent/scanRunner";
import { isPidAlive } from "@/lib/agent/runner";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = (statusParam === "running" || statusParam === "complete" || statusParam === "failed")
    ? (statusParam as ScanRunStatus)
    : undefined;
  const limit = url.searchParams.has("limit")
    ? parseInt(url.searchParams.get("limit")!, 10)
    : undefined;

  const runs = listScanRuns({ status, limit });
  const live = new Set(listLiveScanRuns());

  return NextResponse.json({
    runs: runs.map(r => {
      let viewState: "attached" | "orphan-alive" | "orphan-dead" | "complete" | "failed";
      if (r.status === "complete") viewState = "complete";
      else if (r.status === "failed") viewState = "failed";
      else if (live.has(r.id)) viewState = "attached";
      else if (r.pid !== null && isPidAlive(r.pid)) viewState = "orphan-alive";
      else viewState = "orphan-dead";

      return {
        ...r,
        viewState,
        live: viewState === "attached",
      };
    }),
  });
}
