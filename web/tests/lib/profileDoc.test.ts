import { describe, expect, it } from "vitest";
import {
  parse,
  serialize,
  getString,
  setString,
  getStringList,
  setStringList,
  getObjectList,
  setObjectList,
} from "@/lib/data/profileDoc";

const SAMPLE = `# Career-Ops Profile Configuration
# Single source of truth for personal data.

candidate:
  full_name: "Jane Smith"
  email: "jane@example.com"
  linkedin: "" # TODO: add your URL

target_roles:
  primary:
    - "Senior AI Engineer"
    - "Staff ML Engineer"
  archetypes:
    - name: "AI/ML Engineer"
      level: "Senior"
      fit: "primary"
    - name: "Solutions Architect"
      level: "Mid"
      fit: "adjacent"
`;

describe("profileDoc", () => {
  it("reads scalar fields", () => {
    const doc = parse(SAMPLE);
    expect(getString(doc, ["candidate", "full_name"])).toBe("Jane Smith");
    expect(getString(doc, ["candidate", "email"])).toBe("jane@example.com");
    expect(getString(doc, ["candidate", "missing"])).toBe("");
  });

  it("writes scalar fields and serializes back", () => {
    const doc = parse(SAMPLE);
    setString(doc, ["candidate", "full_name"], "New Name");
    const out = serialize(doc);
    expect(out).toContain('full_name: "New Name"');
    expect(out).toContain("# TODO: add your URL"); // inline comment preserved
    expect(out).toContain("# Career-Ops Profile Configuration"); // header comment preserved
  });

  it("reads string lists", () => {
    const doc = parse(SAMPLE);
    const titles = getStringList(doc, ["target_roles", "primary"]);
    expect(titles).toEqual(["Senior AI Engineer", "Staff ML Engineer"]);
  });

  it("replaces string lists", () => {
    const doc = parse(SAMPLE);
    setStringList(doc, ["target_roles", "primary"], ["Director, AI", "VP, AI"]);
    const out = serialize(doc);
    expect(out).toContain('"Director, AI"');
    expect(out).toContain('"VP, AI"');
    expect(out).not.toContain("Senior AI Engineer");
  });

  it("reads object lists", () => {
    const doc = parse(SAMPLE);
    const arch = getObjectList(doc, ["target_roles", "archetypes"], ["name", "level", "fit"]);
    expect(arch).toHaveLength(2);
    expect(arch[0]).toEqual({ name: "AI/ML Engineer", level: "Senior", fit: "primary" });
    expect(arch[1]).toEqual({ name: "Solutions Architect", level: "Mid", fit: "adjacent" });
  });

  it("writes object lists", () => {
    const doc = parse(SAMPLE);
    setObjectList(
      doc,
      ["target_roles", "archetypes"],
      ["name", "level", "fit"],
      [{ name: "Director, AI", level: "Director", fit: "primary" }],
    );
    const out = serialize(doc);
    expect(out).toContain('name: "Director, AI"');
    expect(out).toContain('fit: "primary"');
    expect(out).not.toContain("Solutions Architect");
  });

  it("preserves comments through round-trip without edits", () => {
    const doc = parse(SAMPLE);
    const out = serialize(doc);
    // Counted comments survive — number of `#` lines unchanged.
    const commentLines = (s: string) => (s.match(/^\s*#/gm) || []).length;
    expect(commentLines(out)).toBe(commentLines(SAMPLE));
  });

  it("ends serialized output with a newline", () => {
    const doc = parse(SAMPLE);
    expect(serialize(doc).endsWith("\n")).toBe(true);
  });

  it("handles empty optional values without producing null", () => {
    const doc = parse(SAMPLE);
    setString(doc, ["candidate", "linkedin"], "");
    const out = serialize(doc);
    // Should be empty string `""`, not bare `linkedin:` (which YAML parses as null).
    expect(out).toMatch(/linkedin:\s*""/);
  });
});
