import { NextResponse } from "next/server";
import { listUserFiles } from "@/lib/data/userFiles";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ files: listUserFiles() });
}
