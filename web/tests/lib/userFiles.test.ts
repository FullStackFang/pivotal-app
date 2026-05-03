import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Vitest's vite loader requires static import strings — each test gets a unique
// `?suffix` so the module re-evaluates against the new CAREER_OPS_ROOT env var.
// The matching `userFiles-cache-bust.d.ts` declares the types for each suffix.

let tmpRoot: string;

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "career-ops-uf-"));
  fs.mkdirSync(path.join(root, "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "modes"), { recursive: true });
  fs.mkdirSync(path.join(root, "templates"), { recursive: true });
  fs.writeFileSync(path.join(root, "cv.md"), "# Test CV\n");
  return root;
}

beforeEach(() => {
  tmpRoot = makeRoot();
  process.env.CAREER_OPS_ROOT = tmpRoot;
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  delete process.env.CAREER_OPS_ROOT;
});

describe("userFiles", () => {
  it("listUserFiles returns the safelisted files with metadata", async () => {
    const { listUserFiles } = await import("../../lib/data/userFiles.js?t=list");
    const files = listUserFiles();
    const keys = files.map((f) => f.key).sort();
    expect(keys).toEqual(["cv", "narrative", "portals", "profile", "proof-points"]);
    const cv = files.find((f) => f.key === "cv")!;
    expect(cv.exists).toBe(true);
    expect(cv.format).toBe("markdown");
  });

  it("readUserFile falls back to the bundled template when the file is missing", async () => {
    fs.writeFileSync(
      path.join(tmpRoot, "config", "profile.example.yml"),
      "candidate:\n  full_name: Sample Person\n",
    );
    const { readUserFile } = await import("../../lib/data/userFiles.js?t=tpl");
    const profile = readUserFile("profile");
    expect(profile.exists).toBe(false);
    expect(profile.content).toContain("Sample Person");
    expect(profile.isPristine).toBe(true);
  });

  it("writeUserFile creates the file atomically and reports valid metadata", async () => {
    const { writeUserFile, readUserFile } = await import(
      "../../lib/data/userFiles.js?t=write"
    );
    const result = writeUserFile("profile", "candidate:\n  full_name: Tester\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.exists).toBe(true);
    expect(result.meta.size).toBeGreaterThan(0);

    const read = readUserFile("profile");
    expect(read.content).toContain("Tester");
  });

  it("writeUserFile rejects invalid YAML with a position", async () => {
    const { writeUserFile } = await import("../../lib/data/userFiles.js?t=invalid");
    const result = writeUserFile(
      "profile",
      "candidate:\n  full_name: 'Tester\n  email: 'broken\n",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
    expect(typeof result.line).toBe("number");
  });

  it("writeUserFile preserves YAML comments byte-for-byte", async () => {
    const { writeUserFile, readUserFile } = await import(
      "../../lib/data/userFiles.js?t=comments"
    );
    const body = "# Top comment\ncandidate:\n  # inline comment\n  full_name: Tester\n";
    writeUserFile("profile", body);
    const read = readUserFile("profile");
    expect(read.content).toBe(body);
  });

  it("writeUserFile appends a trailing newline if missing", async () => {
    const { writeUserFile, readUserFile } = await import(
      "../../lib/data/userFiles.js?t=newline"
    );
    writeUserFile("profile", "candidate:\n  full_name: Tester");
    expect(readUserFile("profile").content.endsWith("\n")).toBe(true);
  });

  it("writeUserFile accepts plain markdown without YAML validation", async () => {
    const { writeUserFile } = await import("../../lib/data/userFiles.js?t=md");
    const result = writeUserFile("cv", "# Title\n\n## Section\n\n- bullet\n");
    expect(result.ok).toBe(true);
  });

  it("getUserFileSpec returns null for unknown keys (path traversal defence)", async () => {
    const { getUserFileSpec } = await import("../../lib/data/userFiles.js?t=spec");
    expect(getUserFileSpec("../../../etc/passwd")).toBeNull();
    expect(getUserFileSpec("cv")).not.toBeNull();
  });

  it("isPristine flips to false after the user customises a templated file", async () => {
    fs.writeFileSync(
      path.join(tmpRoot, "config", "profile.example.yml"),
      "candidate:\n  full_name: Sample\n",
    );
    fs.writeFileSync(
      path.join(tmpRoot, "config", "profile.yml"),
      "candidate:\n  full_name: Sample\n",
    );
    const { listUserFiles, writeUserFile } = await import(
      "../../lib/data/userFiles.js?t=pristine"
    );
    const before = listUserFiles().find((f) => f.key === "profile")!;
    expect(before.isPristine).toBe(true);

    writeUserFile("profile", "candidate:\n  full_name: Real Person\n");
    const after = listUserFiles().find((f) => f.key === "profile")!;
    expect(after.isPristine).toBe(false);
  });
});
