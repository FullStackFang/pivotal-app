import { describe, expect, it } from "vitest";
import { parse, serialize, type Section } from "@/lib/data/cvDoc";

const SAMPLE = `# Jane Smith

**Location:** San Francisco, CA
**Email:** jane@example.com
**LinkedIn:** [LinkedIn](https://linkedin.com/in/janesmith)

---

## Executive Summary

A short summary paragraph that describes the candidate.

---

## Core Competencies

- AI Systems Architecture
- Production RAG Pipelines
- Cross-Functional Leadership

---

## Work Experience

### Acme Corp — Remote

**Principal Engineer**
*Jan 2022 – Present*

*Series-C startup, 200 employees*

- **Platform Migration** – Led a 6-month re-platforming effort that cut p95 latency 40%.
- **Hiring** – Grew the platform team from 4 to 12 engineers.

#### Acme Subsidiary — Tech Lead
*2023 – Present*

- **AI Eval Pipeline** – Stood up the org's first eval pipeline.

---

### Big Co — New York, NY

**Staff Engineer**
*2018 – 2022*

- **Reliability** – Cut incidents 50% with a new on-call rotation.

---

## Education

**Cornell University**
M.S., Computer Science
*2018*

**MIT**
B.S., Computer Science

---

## Personal Note

This section is unknown to the schema and should round-trip as raw markdown.

| Foo | Bar |
|-----|-----|
| 1   | 2   |
`;

describe("cvDoc.parse", () => {
  it("captures the header", () => {
    const doc = parse(SAMPLE);
    const header = doc.sections[0];
    expect(header.kind).toBe("header");
    if (header.kind !== "header") throw new Error("type guard");
    expect(header.name).toBe("Jane Smith");
    expect(header.contacts).toEqual([
      { label: "Location", value: "San Francisco, CA" },
      { label: "Email", value: "jane@example.com" },
      { label: "LinkedIn", value: "LinkedIn", href: "https://linkedin.com/in/janesmith" },
    ]);
  });

  it("classifies known sections", () => {
    const doc = parse(SAMPLE);
    const kinds = doc.sections.map((s) => s.kind);
    expect(kinds).toEqual(["header", "prose", "list", "experience", "education", "raw"]);
  });

  it("parses prose body", () => {
    const doc = parse(SAMPLE);
    const summary = doc.sections.find((s) => s.kind === "prose")!;
    if (summary.kind !== "prose") throw new Error("guard");
    expect(summary.title).toBe("Executive Summary");
    expect(summary.body).toContain("short summary paragraph");
  });

  it("parses bulleted list section", () => {
    const doc = parse(SAMPLE);
    const list = doc.sections.find((s) => s.kind === "list")!;
    if (list.kind !== "list") throw new Error("guard");
    expect(list.items).toEqual([
      "AI Systems Architecture",
      "Production RAG Pipelines",
      "Cross-Functional Leadership",
    ]);
  });

  it("parses work experience jobs and sub-engagements", () => {
    const doc = parse(SAMPLE);
    const exp = doc.sections.find((s) => s.kind === "experience")!;
    if (exp.kind !== "experience") throw new Error("guard");
    expect(exp.jobs).toHaveLength(2);

    const acme = exp.jobs[0];
    expect(acme.company).toBe("Acme Corp");
    expect(acme.location).toBe("Remote");
    expect(acme.title).toBe("Principal Engineer");
    expect(acme.dates).toBe("Jan 2022 – Present");
    expect(acme.context).toBe("Series-C startup, 200 employees");
    expect(acme.bullets).toHaveLength(2);
    expect(acme.bullets[0]).toContain("Platform Migration");
    expect(acme.subEngagements).toHaveLength(1);
    expect(acme.subEngagements[0].heading).toBe("Acme Subsidiary — Tech Lead");
    expect(acme.subEngagements[0].dates).toBe("2023 – Present");
    expect(acme.subEngagements[0].bullets).toHaveLength(1);

    const bigco = exp.jobs[1];
    expect(bigco.company).toBe("Big Co");
    expect(bigco.location).toBe("New York, NY");
    expect(bigco.title).toBe("Staff Engineer");
    expect(bigco.dates).toBe("2018 – 2022");
    expect(bigco.subEngagements).toHaveLength(0);
  });

  it("parses education entries", () => {
    const doc = parse(SAMPLE);
    const edu = doc.sections.find((s) => s.kind === "education")!;
    if (edu.kind !== "education") throw new Error("guard");
    expect(edu.entries).toEqual([
      { school: "Cornell University", degree: "M.S., Computer Science", dates: "2018" },
      { school: "MIT", degree: "B.S., Computer Science", dates: undefined },
    ]);
  });

  it("preserves unknown sections as raw markdown", () => {
    const doc = parse(SAMPLE);
    const raw = doc.sections.find((s) => s.kind === "raw")!;
    if (raw.kind !== "raw") throw new Error("guard");
    expect(raw.title).toBe("Personal Note");
    expect(raw.body).toContain("| Foo | Bar |");
  });
});

describe("cvDoc.serialize", () => {
  it("round-trips known sections without losing content", () => {
    const doc = parse(SAMPLE);
    const out = serialize(doc);
    const reparsed = parse(out);
    // Equivalent structure after a second pass.
    expect(reparsed.sections.length).toBe(doc.sections.length);
    expect(reparsed.sections.map((s) => s.kind)).toEqual(doc.sections.map((s) => s.kind));
  });

  it("ends output with a trailing newline", () => {
    const doc = parse(SAMPLE);
    expect(serialize(doc).endsWith("\n")).toBe(true);
  });

  it("emits header contact links with the link target intact", () => {
    const doc = parse(SAMPLE);
    const out = serialize(doc);
    expect(out).toContain("**LinkedIn:** [LinkedIn](https://linkedin.com/in/janesmith)");
  });

  it("preserves table content inside raw sections", () => {
    const doc = parse(SAMPLE);
    const out = serialize(doc);
    expect(out).toContain("| Foo | Bar |");
  });

  it("survives field edits", () => {
    const doc = parse(SAMPLE);
    const header = doc.sections[0];
    if (header.kind !== "header") throw new Error("guard");
    header.name = "Edited Name";
    const out = serialize(doc);
    expect(out).toMatch(/^# Edited Name/);
  });

  it("handles empty experience and education without crashing", () => {
    const doc = parse(SAMPLE);
    const exp = doc.sections.find((s) => s.kind === "experience") as Section & { kind: "experience" };
    exp.jobs = [];
    const edu = doc.sections.find((s) => s.kind === "education") as Section & { kind: "education" };
    edu.entries = [];
    const out = serialize(doc);
    expect(out).toContain("## Work Experience");
    expect(out).toContain("## Education");
  });
});
