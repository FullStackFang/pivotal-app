import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";

describe("paths", () => {
  const original = process.env.CAREER_OPS_ROOT;
  afterEach(() => {
    if (original === undefined) delete process.env.CAREER_OPS_ROOT;
    else process.env.CAREER_OPS_ROOT = original;
  });

  it("defaults to a directory above web/", async () => {
    delete process.env.CAREER_OPS_ROOT;
    const mod = await import("../../lib/paths.js?default-test");
    expect(path.basename(mod.CAREER_OPS_ROOT)).not.toBe("web");
  });

  it("honors CAREER_OPS_ROOT env var", async () => {
    process.env.CAREER_OPS_ROOT = "/tmp/career-ops-fixture";
    const mod = await import("../../lib/paths.js?env-test");
    expect(mod.CAREER_OPS_ROOT).toBe("/tmp/career-ops-fixture");
  });

  it("derives APPLICATIONS_FILE and REPORTS_DIR", async () => {
    process.env.CAREER_OPS_ROOT = "/tmp/career-ops-fixture";
    const mod = await import("../../lib/paths.js?derived-test");
    expect(mod.APPLICATIONS_FILE).toBe("/tmp/career-ops-fixture/data/applications.md");
    expect(mod.REPORTS_DIR).toBe("/tmp/career-ops-fixture/reports");
  });
});
