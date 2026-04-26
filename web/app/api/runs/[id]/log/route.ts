import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getEvalRun } from "@/lib/data/sqlite";
import { resolveEvalRunsDir } from "@/lib/agent/runner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const run = getEvalRun(id);
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Path traversal guard: the resolved log path must live under EVAL_RUNS_DIR.
  const evalRunsDir = path.resolve(resolveEvalRunsDir());
  const resolved = path.resolve(run.logPath);
  if (!resolved.startsWith(evalRunsDir + path.sep) && resolved !== evalRunsDir) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tail = Math.max(1, Math.min(2000,
    parseInt(new URL(req.url).searchParams.get("tail") ?? "200", 10) || 200
  ));

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ lines: [], truncated: false });
  }

  const raw = fs.readFileSync(resolved, "utf8");
  const allLines = raw.split("\n");
  // Trim trailing empty line from final newline
  if (allLines.length && allLines[allLines.length - 1] === "") allLines.pop();
  const truncated = allLines.length > tail;
  const lines = truncated ? allLines.slice(-tail) : allLines;

  return NextResponse.json({ lines, truncated });
}
