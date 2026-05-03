import { NextResponse } from "next/server";
import { updateCompany, deleteCompany } from "@/lib/portals";

const SLUG_RE = /^[a-z0-9-]+$/;

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "invalid slug" }, { status: 400 });

  let body: { enabled?: boolean; priority?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const updated = updateCompany(slug, {
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    priority: typeof body.priority === "boolean" ? body.priority : undefined,
  });

  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ company: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "invalid slug" }, { status: 400 });

  const ok = deleteCompany(slug);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
