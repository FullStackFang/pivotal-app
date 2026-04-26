import { NextResponse } from "next/server";
import { getEvalRun, listRunningEvalRuns } from "@/lib/data/sqlite";
import { isPidAlive, listLiveRuns, runEvaluation } from "@/lib/agent/runner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const source = getEvalRun(id);
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const force = new URL(req.url).searchParams.get("force") === "true";

  if (!force) {
    const liveIds = new Set(listLiveRuns());
    const sameUrlRunning = listRunningEvalRuns().filter(r => r.id !== id && r.url === source.url);
    const stillAlive = sameUrlRunning.find(r =>
      liveIds.has(r.id) || (r.pid !== null && isPidAlive(r.pid))
    );
    if (stillAlive) {
      return NextResponse.json(
        { ok: false, reason: "duplicate-active", existingRunId: stillAlive.id },
        { status: 409 }
      );
    }
  }

  const { runId: newRunId } = runEvaluation(source.url);
  return NextResponse.json({ ok: true, newRunId });
}
