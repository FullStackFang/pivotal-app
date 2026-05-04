import type { Report } from "../types";

export interface ParsedSection {
  id: string;
  code?: string;
  title: string;
}

export interface ParsedScoreRow {
  block: string;
  score: string;
  scoreNum: number | null;
  note: string;
  isGlobal: boolean;
}

export interface LegitimacyTier {
  label: string;
  tone: "sage" | "amber" | "oxblood" | "navy";
}

export interface ParsedReport {
  title: string;
  meta: {
    date?: string;
    url?: string;
    archetype?: string;
    scoreValue?: number;
    scoreMax?: number;
    scoreRaw?: string;
    legitimacy?: string;
    legitimacyTier?: LegitimacyTier;
    pdf?: string;
  };
  body: string;
  sections: ParsedSection[];
  scoreBreakdown: ParsedScoreRow[];
  recommendationFirstPara?: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function legitimacyTier(value: string): LegitimacyTier {
  const v = value.toLowerCase();
  if (v.includes("strong") || v.includes("legitimate") || v.includes("verified")) {
    return { label: value, tone: "sage" };
  }
  if (v.includes("caution") || v.includes("verify") || v.includes("uncertain")) {
    return { label: value, tone: "amber" };
  }
  if (v.includes("concern") || v.includes("ghost") || v.includes("avoid") || v.includes("expired")) {
    return { label: value, tone: "oxblood" };
  }
  return { label: value, tone: "navy" };
}

function parseScoreCell(cell: string): number | null {
  const cleaned = cell.replace(/\*\*/g, "").trim();
  const m = cleaned.match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseReport(report: Report): ParsedReport {
  const lines = report.bodyMd.split(/\r?\n/);
  let i = 0;

  // ── Title (first H1) ──────────────────────────────────────────────
  while (i < lines.length && !lines[i].startsWith("# ")) i++;
  let title = "";
  if (i < lines.length) {
    title = lines[i].slice(2).trim().replace(/^Evaluation:\s*/i, "");
    i++;
  }

  // ── Front-matter (bold key/value pairs until --- or H2) ───────────
  const meta: ParsedReport["meta"] = {};
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "---") { i++; break; }
    if (line.startsWith("## ")) break;

    const m = line.match(/^\*\*([^:*]+):\*\*\s*(.+?)\s*$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      const value = m[2].trim();
      if (key === "date") meta.date = value;
      else if (key === "url") meta.url = value;
      else if (key === "archetype") meta.archetype = value;
      else if (key === "score") {
        meta.scoreRaw = value;
        const sm = value.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
        if (sm) {
          meta.scoreValue = parseFloat(sm[1]);
          meta.scoreMax = parseInt(sm[2], 10);
        }
      } else if (key === "legitimacy") {
        meta.legitimacy = value.replace(/^\*\*|\*\*$/g, "");
        meta.legitimacyTier = legitimacyTier(meta.legitimacy);
      } else if (key === "pdf") meta.pdf = value;
    }
    i++;
  }

  // Skip leading blanks of body
  while (i < lines.length && lines[i].trim() === "") i++;

  const bodyStartLine = i;
  const body = lines.slice(bodyStartLine).join("\n");

  // ── Sections (all H2s) ───────────────────────────────────────────
  const sections: ParsedSection[] = [];
  for (let j = bodyStartLine; j < lines.length; j++) {
    const h2 = lines[j].match(/^##\s+(.+?)\s*$/);
    if (!h2) continue;
    const raw = h2[1].trim();
    const coded = raw.match(/^([A-Z])\)\s*(.+)$/);
    if (coded) {
      sections.push({
        id: slugify(`${coded[1]}-${coded[2]}`),
        code: coded[1],
        title: coded[2].trim(),
      });
    } else {
      sections.push({ id: slugify(raw), title: raw });
    }
  }

  // ── Score breakdown table parsing ────────────────────────────────
  const scoreBreakdown: ParsedScoreRow[] = [];
  const sbIdx = lines.findIndex(l => /^##\s+Score breakdown/i.test(l));
  if (sbIdx !== -1) {
    let k = sbIdx + 1;
    while (k < lines.length && !lines[k].trim().startsWith("|")) k++;
    if (lines[k]?.trim().startsWith("|")) k += 2; // skip header + separator
    while (k < lines.length && lines[k].trim().startsWith("|")) {
      const cells = lines[k].split("|").slice(1, -1).map(c => c.trim());
      if (cells.length >= 2) {
        const block = cells[0].replace(/\*\*/g, "").trim();
        const isGlobal = /global/i.test(block);
        scoreBreakdown.push({
          block,
          score: cells[1].replace(/\*\*/g, "").trim(),
          scoreNum: parseScoreCell(cells[1]),
          note: (cells[2] ?? "").replace(/\*\*/g, "").trim(),
          isGlobal,
        });
      }
      k++;
    }
  }

  // ── First paragraph of Recommendation (for hero pull-quote) ──────
  let recommendationFirstPara: string | undefined;
  const recIdx = lines.findIndex(l => /^##\s+Recommendation/i.test(l));
  if (recIdx !== -1) {
    let k = recIdx + 1;
    while (k < lines.length && lines[k].trim() === "") k++;
    if (k < lines.length && lines[k].trim() && !lines[k].startsWith("#")) {
      const para: string[] = [];
      while (k < lines.length && lines[k].trim() && !lines[k].startsWith("#")) {
        para.push(lines[k].trim());
        k++;
      }
      recommendationFirstPara = para.join(" ");
    }
  }

  return { title, meta, body, sections, scoreBreakdown, recommendationFirstPara };
}
