import { NextResponse } from "next/server";
import {
  getUserFileSpec,
  readUserFile,
  writeUserFile,
  type UserFileKey,
} from "@/lib/data/userFiles";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const spec = getUserFileSpec(key);
  if (!spec) return NextResponse.json({ error: "unknown_file" }, { status: 404 });
  const file = readUserFile(spec.key as UserFileKey);
  return NextResponse.json({ file });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const spec = getUserFileSpec(key);
  if (!spec) return NextResponse.json({ error: "unknown_file" }, { status: 404 });

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "missing_content" }, { status: 400 });
  }

  const result = writeUserFile(spec.key as UserFileKey, body.content);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: result.error,
        line: result.line,
        column: result.column,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ file: result.meta });
}
