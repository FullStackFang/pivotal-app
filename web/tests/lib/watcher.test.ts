import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, listApplications } from "../../lib/data/sqlite.js";
import { startWatcher } from "../../lib/data/watcher.js";

let tmp: string;
let stop: (() => void) | null = null;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "co-watch-"));
  process.env.CAREER_OPS_ROOT = tmp;
  fs.mkdirSync(path.join(tmp, "data"));
  fs.mkdirSync(path.join(tmp, "reports"));
  fs.writeFileSync(path.join(tmp, "data/applications.md"),
    "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n");
  openDb(":memory:");
});
afterEach(() => { stop?.(); stop = null; });

describe("watcher", () => {
  it("indexes new application rows after file change", async () => {
    stop = startWatcher();
    await new Promise(r => setTimeout(r, 200));

    fs.writeFileSync(path.join(tmp, "data/applications.md"),
      "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 1 | 2026-01-01 | A | R | 4/5 | Applied | ✅ | [001](reports/001.md) | x |\n");

    await new Promise(r => setTimeout(r, 800));
    expect(listApplications({}).length).toBe(1);
  });
});
