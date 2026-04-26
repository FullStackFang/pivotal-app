import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parseApplications } from "../../lib/data/markdown.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "../fixtures/applications.md");

describe("parseApplications", () => {
  it("parses every row of the GFM tracker table", () => {
    expect(parseApplications(fixture)).toHaveLength(4);
  });

  it("extracts num, date, company, role, score, status, pdf, report, notes", () => {
    const [first] = parseApplications(fixture);
    expect(first.num).toBe(41);
    expect(first.date).toBe("2026-04-23");
    expect(first.company).toBe("Anthropic");
    expect(first.role).toBe("Head of Applied AI, Enterprise");
    expect(first.score).toBe(4.8);
    expect(first.status).toBe("Interview");
    expect(first.pdfPresent).toBe(true);
    expect(first.reportNum).toBe(41);
    expect(first.notes).toBe("R3, warm intro via Liane");
  });

  it("treats ❌ as pdfPresent=false", () => {
    const replit = parseApplications(fixture).find(a => a.company === "Replit")!;
    expect(replit.pdfPresent).toBe(false);
  });

  it("populates sourceLine matching the line in the file", () => {
    expect(parseApplications(fixture)[0].sourceLine).toBe(5);
  });

  it("returns empty array if no rows", () => {
    const empty = path.join(here, "../fixtures/empty.md");
    fs.writeFileSync(empty, "# nothing here\n");
    expect(parseApplications(empty)).toEqual([]);
  });
});
