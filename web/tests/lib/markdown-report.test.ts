import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReport } from "../../lib/data/markdown.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "../fixtures/reports/041-anthropic-2026-04-23.md");

describe("parseReport", () => {
  const r = parseReport(fixture);

  it("derives num from filename", () => expect(r.num).toBe(41));
  it("captures URL", () => expect(r.url).toBe("https://anthropic.com/careers/head-applied-ai"));
  it("captures legitimacy", () => expect(r.legitimacy).toBe("Verified"));
  it("extracts A–G score scalars", () => {
    expect(r.scores.A).toBe(4.8);
    expect(r.scores.B).toBe(4.7);
    expect(r.scores.G).toBe(5.0);
  });
  it("returns full body markdown", () => expect(r.bodyMd).toMatch(/Block A — Role & Scope/));
  it("stores absolute path ending with the filename", () => {
    expect(r.path.endsWith("041-anthropic-2026-04-23.md")).toBe(true);
  });
});
