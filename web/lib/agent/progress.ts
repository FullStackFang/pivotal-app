import type { EvalEvent } from "../types.js";

const BLOCK_RE  = /Block\s+(\d+)\s*\/\s*(\d+)\s*[:·-]\s*(.+)$/;
const REPORT_RE = /Writing report\s+(\d{3})-(.+\.md)/i;
const TRACK_RE  = /Tracker updated/i;

export function parseClaudeLine(line: string): EvalEvent | null {
  const b = line.match(BLOCK_RE);
  if (b) return {
    type: "progress",
    block: parseInt(b[1], 10),
    total: parseInt(b[2], 10),
    label: b[3].trim(),
  };

  const r = line.match(REPORT_RE);
  if (r) return {
    type: "report-written",
    num: parseInt(r[1], 10),
    path: `${r[1]}-${r[2]}`,
  };

  if (TRACK_RE.test(line)) return { type: "tracker-updated" };
  return null;
}
