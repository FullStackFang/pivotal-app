import { NextResponse } from "next/server";
import { getReport } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

let warmed = false;
function warm() { if (!warmed) { fullIndex(); warmed = true; } }

export async function GET(_req: Request, { params }: { params: Promise<{ num: string }> }) {
  warm();
  const { num } = await params;
  const r = getReport(parseInt(num, 10));
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ report: r });
}
