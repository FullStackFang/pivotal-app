import type { EvalEvent } from "../types.js";

const BLOCK_RE      = /Block\s+(\d+)\s*\/\s*(\d+)\s*[:·-]\s*(.+)$/;
// Many forms recognize a "report N produced" line. Order matters — try
// the most specific patterns first.
const WRITING_RE    = /Writing report\s+(\d{3})-(.+\.md)/i;
const REPORT_PATH_RE = /reports\/(\d{3})-([^\s`'"<>]+\.md)/i;
const TRACK_RE      = /Tracker\s*(?:updated|:)/i;

export function parseClaudeLine(line: string): EvalEvent | null {
  const b = line.match(BLOCK_RE);
  if (b) return {
    type: "progress",
    block: parseInt(b[1], 10),
    total: parseInt(b[2], 10),
    label: b[3].trim(),
  };

  // "Writing report 042-acme-...md" — the original explicit form.
  const w = line.match(WRITING_RE);
  if (w) return {
    type: "report-written",
    num: parseInt(w[1], 10),
    path: `${w[1]}-${w[2]}`,
  };

  // Catches "**Filed:** reports/042-acme-...md", "Report: reports/042-...",
  // and any other line that mentions a report path.
  const p = line.match(REPORT_PATH_RE);
  if (p) return {
    type: "report-written",
    num: parseInt(p[1], 10),
    path: `${p[1]}-${p[2]}`,
  };

  if (TRACK_RE.test(line)) return { type: "tracker-updated" };
  return null;
}
