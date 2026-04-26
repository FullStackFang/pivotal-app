import { NextResponse } from "next/server";
import { fullIndex } from "@/lib/data/indexer";

export async function POST() {
  const result = fullIndex();
  return NextResponse.json({ result });
}
