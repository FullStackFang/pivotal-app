// Text extraction for resume ingestion. Handles PDF, DOCX, and plain text.
//
// Each extractor returns the raw text the LLM will read. We keep the surface
// minimal and avoid pre-processing the text (no markdown conversion here) — we
// want the model to see the resume the way a recruiter would.

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type SupportedKind = "pdf" | "docx" | "text";

export interface ExtractedResume {
  kind: SupportedKind;
  text: string;
}

export function detectKind(filename: string, mime: string | undefined): SupportedKind | null {
  const lower = filename.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    mime === "text/plain" ||
    mime === "text/markdown" ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  ) {
    return "text";
  }
  return null;
}

export async function extractFromBuffer(
  kind: SupportedKind,
  buf: Buffer,
): Promise<ExtractedResume> {
  if (kind === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const result = await parser.getText();
      return { kind, text: normalize(result.text) };
    } finally {
      await parser.destroy();
    }
  }
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: buf });
    return { kind, text: normalize(result.value) };
  }
  return { kind, text: normalize(buf.toString("utf8")) };
}

function normalize(text: string): string {
  // Collapse Windows line endings and runs of 3+ blank lines, but keep the
  // structure the model needs to recognize section breaks.
  return text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
