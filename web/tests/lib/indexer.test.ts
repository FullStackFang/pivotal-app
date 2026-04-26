import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, listApplications, getReport } from "../../lib/data/sqlite.js";
import { fullIndex, indexApplicationsFile, indexReportFile } from "../../lib/data/indexer.js";

let tmp: string;

function seed(root: string) {
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "data/applications.md"),
    "# Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 41 | 2026-04-23 | Anthropic | Head AI | 4.8/5 | Interview | ✅ | [041](reports/041-anthropic-2026-04-23.md) | ok |\n"
  );
  fs.writeFileSync(
    path.join(root, "reports/041-anthropic-2026-04-23.md"),
    "# Anthropic\n\n**URL:** https://x\n**Legitimacy:** Verified\n\n## Block A — scope (4.8)\nbody\n"
  );
}

describe("indexer", () => {
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "co-idx-"));
    process.env.CAREER_OPS_ROOT = tmp;
    seed(tmp);
    openDb(":memory:");
  });

  it("fullIndex populates applications and reports", () => {
    const result = fullIndex();
    expect(result.errors).toEqual([]);
    expect(listApplications({})).toHaveLength(1);
    expect(getReport(41)?.url).toBe("https://x");
  });

  it("indexApplicationsFile is idempotent", () => {
    fullIndex();
    indexApplicationsFile();
    expect(listApplications({})).toHaveLength(1);
  });

  it("indexReportFile updates a row when content changes", () => {
    fullIndex();
    const reportPath = path.join(tmp, "reports/041-anthropic-2026-04-23.md");
    fs.writeFileSync(reportPath, "# A\n\n**URL:** https://y\n**Legitimacy:** Stale\n");
    indexReportFile(reportPath);
    expect(getReport(41)?.url).toBe("https://y");
    expect(getReport(41)?.legitimacy).toBe("Stale");
  });

  it("removes applications no longer in the file", () => {
    fullIndex();
    fs.writeFileSync(path.join(tmp, "data/applications.md"),
      "# Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n");
    indexApplicationsFile();
    expect(listApplications({})).toHaveLength(0);
  });
});
