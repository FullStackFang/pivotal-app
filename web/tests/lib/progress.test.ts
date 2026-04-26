import { describe, it, expect } from "vitest";
import { parseClaudeLine } from "../../lib/agent/progress.js";

describe("parseClaudeLine", () => {
  it("recognizes 'Block N/M: label'", () => {
    expect(parseClaudeLine("Block 4/6: level strategy")).toEqual({
      type: "progress", block: 4, total: 6, label: "level strategy",
    });
  });

  it("recognizes 'Writing report 042-...'", () => {
    expect(parseClaudeLine("Writing report 042-acme-2026-04-21.md")).toEqual({
      type: "report-written", num: 42, path: "042-acme-2026-04-21.md",
    });
  });

  it("recognizes tracker update", () => {
    expect(parseClaudeLine("Tracker updated: applications.md")?.type).toBe("tracker-updated");
  });

  it("returns null for unknown lines", () => {
    expect(parseClaudeLine("hello world")).toBeNull();
  });
});
