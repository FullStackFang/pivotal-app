import { NextResponse } from "next/server";
import { getEvalRun } from "@/lib/data/sqlite";
import { computeViewState, liveIdSet } from "@/lib/agent/runState";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const run = getEvalRun(id);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    run: { ...run, viewState: computeViewState(run, liveIdSet()) },
  });
}
