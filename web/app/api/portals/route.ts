import { NextResponse } from "next/server";
import { readPortals, addCompany } from "@/lib/portals";

export async function GET() {
  const result = readPortals();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  let body: { name?: string; careersUrl?: string; priority?: boolean; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.name || !body.careersUrl) {
    return NextResponse.json({ error: "name and careersUrl required" }, { status: 400 });
  }

  const result = addCompany({
    name: body.name,
    careersUrl: body.careersUrl,
    priority: body.priority,
    notes: body.notes,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ company: result }, { status: 201 });
}
