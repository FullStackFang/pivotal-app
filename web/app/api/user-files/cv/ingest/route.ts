import { NextResponse } from "next/server";
import { detectKind, extractFromBuffer } from "@/lib/ingest/extract";
import { ingestResume } from "@/lib/ingest/claude";
import { serialize, type CvDoc } from "@/lib/data/cvDoc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Resume ingestion can take 30-60 seconds — the model writes a few thousand
// tokens of structured JSON. Bump the route's max duration accordingly.
export const maxDuration = 120;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — comfortably above any real resume.
const MAX_TEXT_BYTES = 200_000; // ~50k tokens; refuse rather than silently truncate.

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Expected multipart/form-data with a `file` field." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Attach the resume file in the `file` field." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: "file_too_large",
        message: `Resume exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB. Upload a smaller file.`,
      },
      { status: 413 },
    );
  }

  const kind = detectKind(file.name, file.type);
  if (!kind) {
    return NextResponse.json(
      {
        error: "unsupported_format",
        message: `Unsupported file type. Upload a PDF, DOCX, or plain-text resume.`,
      },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let text: string;
  try {
    const extracted = await extractFromBuffer(kind, buf);
    text = extracted.text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "extract_failed",
        message: `Could not extract text from the ${kind.toUpperCase()}: ${msg}`,
      },
      { status: 422 },
    );
  }

  if (!text.trim()) {
    return NextResponse.json(
      {
        error: "empty_resume",
        message:
          "Extracted text was empty. The PDF may be scan-only — try a text-based PDF or a DOCX export.",
      },
      { status: 422 },
    );
  }

  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    return NextResponse.json(
      {
        error: "resume_too_large",
        message:
          "Resume exceeds the supported size after text extraction. Trim it down or split into multiple sections before ingesting.",
      },
      { status: 413 },
    );
  }

  try {
    const result = await ingestResume(text);
    // The Zod schema emits `null` for unused optional fields; the cvDoc
    // runtime types treat them as undefined/missing. Normalise here so the
    // serializer behaves identically.
    const doc = { sections: result.doc.sections.map((s) => stripNulls(s)) } as CvDoc;
    const markdown = serialize(doc);
    return NextResponse.json({
      markdown,
      sourceKind: kind,
      sourceFilename: file.name,
      sourceBytes: file.size,
      extractedTextLength: text.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("`claude` CLI not found")) {
      return NextResponse.json(
        { error: "claude_cli_missing", message: msg },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "ingest_failed", message: msg },
      { status: 500 },
    );
  }
}

// The Zod schema produces `null` for unused optional fields. The cvDoc
// runtime types use `undefined`/missing for the same. Convert here so the
// serializer behaves identically whether the doc came from the parser or the
// LLM.
type AnyRecord = Record<string, unknown>;
function stripNulls<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripNulls(item)) as unknown as T;
  }
  if (input && typeof input === "object") {
    const out: AnyRecord = {};
    for (const [k, v] of Object.entries(input as AnyRecord)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out as T;
  }
  return input;
}
