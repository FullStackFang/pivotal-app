// Zod schema describing the structured cv.md document the LLM must emit.
// Mirrors the runtime types in `lib/data/cvDoc.ts`. The server feeds the
// returned object to `serialize()` to produce canonical markdown.

import { z } from "zod";

const ContactPair = z.object({
  label: z.string().describe("Field label, e.g. 'Email', 'LinkedIn', 'Location', 'Phone'."),
  value: z.string().describe("Display text. For a link, this is the visible text; the URL goes in `href`."),
  href: z.string().nullable().describe("URL when the value is a link, otherwise null."),
});

const HeaderSection = z.object({
  kind: z.literal("header"),
  name: z.string().describe("The candidate's full name (without `# ` prefix)."),
  contacts: z.array(ContactPair).describe(
    "Bold key/value contact pairs that appear under the name. Order matters — keep the order shown on the resume.",
  ),
});

const ProseSection = z.object({
  kind: z.literal("prose"),
  title: z.string().describe("Section heading, e.g. 'Executive Summary', 'Profile'."),
  body: z.string().describe("Plain prose. Multi-paragraph allowed via blank lines."),
});

const ListSection = z.object({
  kind: z.literal("list"),
  title: z.string().describe("Section heading, e.g. 'Core Competencies', 'Skills'."),
  items: z.array(z.string()).describe("Bullet items. One short phrase per item."),
});

const ExperienceSub = z.object({
  heading: z.string().describe(
    "Sub-engagement heading, e.g. 'Client Name — Role'. Becomes a `#### {heading}` block.",
  ),
  dates: z.string().nullable().describe("Italic date line under the heading. Null if not specified."),
  bullets: z.array(z.string()),
});

const ExperienceJob = z.object({
  company: z.string().describe("Company name."),
  location: z.string().nullable().describe("City, state, or 'Remote'. Null if not specified."),
  title: z.string().nullable().describe("Job title (rendered as bold). Null only when the role has sub-engagements with their own titles."),
  dates: z.string().nullable().describe("Job-level dates as one italic line, e.g. 'Jan 2022 – Present'. Null if dates only exist on sub-engagements."),
  context: z.string().nullable().describe(
    "Optional italic line under dates that adds context — e.g. company size or stage. Null if absent.",
  ),
  description: z.string().nullable().describe(
    "Optional lead paragraph between the title block and bullets. Useful for advisory/consulting roles. Null when bullets stand alone.",
  ),
  bullets: z.array(z.string()).describe(
    "Achievement bullets. Lead with `**Topic** – ` when the source resume does. Quantify outcomes (latency, $, %, scale).",
  ),
  subEngagements: z.array(ExperienceSub).describe(
    "Sub-engagements when one umbrella role covers multiple client engagements. Empty array when not applicable.",
  ),
});

const ExperienceSection = z.object({
  kind: z.literal("experience"),
  title: z.string().describe("Section heading, e.g. 'Work Experience' or 'Experience'."),
  jobs: z.array(ExperienceJob),
});

const EducationEntry = z.object({
  school: z.string().describe("Institution name. Bold-rendered."),
  degree: z.string().describe("Degree and program, e.g. 'M.S., Computer Science'."),
  dates: z.string().nullable().describe("Italic date line, e.g. 'Expected 2027'. Null if absent."),
});

const EducationSection = z.object({
  kind: z.literal("education"),
  title: z.string().describe("Section heading, usually 'Education'."),
  entries: z.array(EducationEntry),
});

const RawSection = z.object({
  kind: z.literal("raw"),
  title: z.string().describe("Section heading."),
  body: z.string().describe(
    "Markdown body for sections that don't fit a structured shape — tables, custom layouts, lists with mixed content, or anything else. Preserve markdown verbatim.",
  ),
});

const Section = z.discriminatedUnion("kind", [
  HeaderSection,
  ProseSection,
  ListSection,
  ExperienceSection,
  EducationSection,
  RawSection,
]);

export const CvDocSchema = z.object({
  sections: z.array(Section).describe(
    "Sections in document order. The first section MUST be the header. Subsequent sections appear in the order they should render on the CV.",
  ),
});

export type CvDocOutput = z.infer<typeof CvDocSchema>;
