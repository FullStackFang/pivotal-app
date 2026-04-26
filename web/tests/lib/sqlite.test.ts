import { describe, it, expect, beforeEach } from "vitest";
import { openDb, listApplications, upsertApplication, getReport, upsertReport } from "../../lib/data/sqlite.js";
import type { Application, Report } from "../../lib/types.js";

function fakeApp(num: number, status = "Applied", score: number | null = 4.0): Application {
  return {
    num, date: "2026-04-20", company: "Acme", role: "Engineer",
    score, status, pdfPresent: true, reportNum: num,
    notes: "", sourceLine: num + 4, updatedAt: Date.now(),
  };
}
function fakeReport(num: number): Report {
  return {
    num, path: `/tmp/${num}.md`, url: "https://x", legitimacy: "Verified",
    scores: { A: 4.5, B: 4.0, G: 5.0 }, bodyMd: "# r", updatedAt: Date.now(),
  };
}

describe("sqlite", () => {
  beforeEach(() => { openDb(":memory:"); });

  it("upserts and lists applications", () => {
    upsertApplication(fakeApp(1));
    upsertApplication(fakeApp(2, "Offer", 4.6));
    expect(listApplications({})).toHaveLength(2);
  });

  it("filters by status", () => {
    upsertApplication(fakeApp(1, "Applied"));
    upsertApplication(fakeApp(2, "Offer"));
    expect(listApplications({ status: "Offer" })).toHaveLength(1);
  });

  it("filters by query against company/role/notes", () => {
    upsertApplication({ ...fakeApp(1), company: "Anthropic", role: "Head of AI" });
    upsertApplication({ ...fakeApp(2), company: "OpenAI", role: "Engineer" });
    expect(listApplications({ q: "anth" })).toHaveLength(1);
  });

  it("orders by date desc by default", () => {
    upsertApplication({ ...fakeApp(1), date: "2026-01-01" });
    upsertApplication({ ...fakeApp(2), date: "2026-04-01" });
    expect(listApplications({})[0].num).toBe(2);
  });

  it("upserts and gets reports with parsed scores", () => {
    upsertReport(fakeReport(41));
    const r = getReport(41);
    expect(r?.scores.A).toBe(4.5);
    expect(r?.legitimacy).toBe("Verified");
  });

  it("getReport returns null for unknown num", () => {
    expect(getReport(999)).toBeNull();
  });
});
