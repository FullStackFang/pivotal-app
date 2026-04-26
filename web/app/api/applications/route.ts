import { NextResponse } from "next/server";
import { listApplications } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

let warmed = false;
function warm() { if (!warmed) { fullIndex(); warmed = true; } }

export async function GET(req: Request) {
  warm();
  const url = new URL(req.url);
  const apps = listApplications({
    status: url.searchParams.get("status") ?? undefined,
    q:      url.searchParams.get("q") ?? undefined,
    limit:  url.searchParams.has("limit")  ? parseInt(url.searchParams.get("limit")!,  10) : undefined,
    offset: url.searchParams.has("offset") ? parseInt(url.searchParams.get("offset")!, 10) : undefined,
  });
  return NextResponse.json({ applications: apps });
}
