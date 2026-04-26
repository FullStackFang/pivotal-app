import fs from "node:fs";
import path from "node:path";
import { Application, CanonicalStatus, Report, ReportScores } from "../types.js";

const TABLE_HEADER_RE = /^\|\s*#\s*\|\s*Date\s*\|/i;

export function parseApplications(filePath: string): Application[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const lines = raw.split("\n");
  const rows: Application[] = [];

  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTable && TABLE_HEADER_RE.test(line)) {
      inTable = true;
      i++;
      continue;
    }
    if (!inTable) continue;
    if (!line.trim().startsWith("|")) { inTable = false; continue; }

    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    if (cells.length < 9) continue;

    const [numS, date, company, role, scoreS, status, pdfS, reportLink, notes] = cells;
    const num = parseInt(numS, 10);
    if (Number.isNaN(num)) continue;

    const scoreMatch = scoreS.match(/(\d+(?:\.\d+)?)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    const reportNumMatch = reportLink.match(/\[(\d+)\]/);
    const reportNum = reportNumMatch ? parseInt(reportNumMatch[1], 10) : null;

    rows.push({
      num, date, company, role, score,
      status: status as CanonicalStatus,
      pdfPresent: pdfS.includes("✅"),
      reportNum, notes,
      sourceLine: i + 1,
      updatedAt: stat.mtimeMs,
    });
  }
  return rows;
}

const NUM_FROM_FILENAME = /^(\d{3})-/;
const URL_LINE          = /^\*\*URL:\*\*\s*(.+)$/m;
const LEGIT_LINE        = /^\*\*Legitimacy:\*\*\s*(.+)$/m;
const BLOCK_HEADING     = /^##\s+Block\s+([A-G])\b[^(]*\((\d+(?:\.\d+)?)\)/gm;

export function parseReport(filePath: string): Report {
  const raw  = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const base = path.basename(filePath);
  const numMatch = base.match(NUM_FROM_FILENAME);
  if (!numMatch) throw new Error(`Cannot derive num from filename: ${base}`);

  const urlMatch   = raw.match(URL_LINE);
  const legitMatch = raw.match(LEGIT_LINE);

  const scores: ReportScores = {};
  for (const m of raw.matchAll(BLOCK_HEADING)) {
    const key = m[1] as keyof ReportScores;
    scores[key] = parseFloat(m[2]);
  }

  return {
    num: parseInt(numMatch[1], 10),
    path: filePath,
    url: urlMatch?.[1].trim() ?? null,
    legitimacy: legitMatch?.[1].trim() ?? null,
    scores,
    bodyMd: raw,
    updatedAt: stat.mtimeMs,
  };
}
