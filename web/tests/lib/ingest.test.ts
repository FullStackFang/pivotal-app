import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ingest/claude";
import { detectKind } from "@/lib/ingest/extract";

describe("extractJson", () => {
  it("parses a fenced ```json block", () => {
    const stdout = 'Here is the result:\n```json\n{"sections": []}\n```\n';
    expect(extractJson(stdout)).toEqual({ sections: [] });
  });

  it("parses an unlabelled fenced block", () => {
    const stdout = '```\n{"sections": [{"kind":"prose","title":"x","body":"y"}]}\n```';
    const out = extractJson(stdout) as { sections: unknown[] };
    expect(out.sections).toHaveLength(1);
  });

  it("falls back to outermost braces when no fence is present", () => {
    const stdout = 'Reasoning: looks good.\n{"sections": [{"kind":"list","title":"Skills","items":["a","b"]}]}\nDone.';
    const out = extractJson(stdout) as { sections: Array<{ items: string[] }> };
    expect(out.sections[0].items).toEqual(["a", "b"]);
  });

  it("throws a clear error when the output has no JSON", () => {
    expect(() => extractJson("just some prose")).toThrow(/did not contain a JSON object/);
  });

  it("throws when the JSON inside the fence is malformed", () => {
    const stdout = "```json\n{not valid}\n```";
    expect(() => extractJson(stdout)).toThrow();
  });
});

describe("detectKind", () => {
  it("detects pdf by mime type", () => {
    expect(detectKind("resume.bin", "application/pdf")).toBe("pdf");
  });
  it("detects pdf by extension", () => {
    expect(detectKind("resume.PDF", undefined)).toBe("pdf");
  });
  it("detects docx by mime type", () => {
    expect(
      detectKind("r.bin", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ).toBe("docx");
  });
  it("detects docx by extension", () => {
    expect(detectKind("Resume_v3.docx", undefined)).toBe("docx");
  });
  it("detects text variants", () => {
    expect(detectKind("notes.txt", undefined)).toBe("text");
    expect(detectKind("notes.md", undefined)).toBe("text");
    expect(detectKind("any", "text/plain")).toBe("text");
  });
  it("returns null for unsupported types", () => {
    expect(detectKind("photo.jpg", "image/jpeg")).toBeNull();
    expect(detectKind("page.html", "text/html")).toBeNull();
  });
});
