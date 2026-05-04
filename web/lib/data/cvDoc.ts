// Section-based parser/serializer for cv.md.
//
// Strategy: split the file into top-level sections (`## Heading` blocks plus a
// header zone before the first `---`/`##`). Each known section has a typed
// shape; unknown sections fall through as a raw markdown body so we never lose
// the user's content. Rebuilding the document concatenates sections in their
// original order.

export interface ContactPair {
  label: string;
  /** Display text shown to the user. Includes the optional link target. */
  value: string;
  /** Markdown link target if the original was `[text](url)`. */
  href?: string;
}

export interface HeaderSection {
  kind: "header";
  /** Markdown `# Name` line. Stored without the leading `# `. */
  name: string;
  /** Key-value pairs rendered with `**Key:** value`. Preserves order. */
  contacts: ContactPair[];
}

export interface ProseSection {
  kind: "prose";
  title: string;
  body: string;
}

export interface ListSection {
  kind: "list";
  title: string;
  items: string[];
}

export interface ExperienceJob {
  /** First line of `### Company — Location`. We keep the raw line so unknown
   *  decorations (em-dash variants, parenthetical info) survive a round-trip
   *  unless the user edits the structured fields. */
  company: string;
  location?: string;
  /** Bold line under the heading (`**Job Title**`). */
  title?: string;
  /** Italic line (`*Dates*`). */
  dates?: string;
  /** Optional italic context line under dates (`*Multi-subsidiary ...*`). */
  context?: string;
  /** Lead paragraph (non-bullet prose) before bullets / sub-engagements. */
  description?: string;
  bullets: string[];
  subEngagements: ExperienceSub[];
}

export interface ExperienceSub {
  /** `#### Foo — Role` heading. */
  heading: string;
  dates?: string;
  bullets: string[];
}

export interface ExperienceSection {
  kind: "experience";
  title: string;
  jobs: ExperienceJob[];
}

export interface EducationEntry {
  school: string;
  degree: string;
  dates?: string;
}

export interface EducationSection {
  kind: "education";
  title: string;
  entries: EducationEntry[];
}

export interface RawSection {
  kind: "raw";
  title: string;
  body: string;
}

export type Section =
  | HeaderSection
  | ProseSection
  | ListSection
  | ExperienceSection
  | EducationSection
  | RawSection;

export interface CvDoc {
  sections: Section[];
}

const PROSE_TITLES = new Set(["summary", "executive summary", "profile", "objective", "about"]);
const LIST_TITLES = new Set(["core competencies", "skills", "key skills", "competencies"]);
const EXPERIENCE_TITLES = new Set(["work experience", "experience", "professional experience"]);
const EDUCATION_TITLES = new Set(["education"]);

export function parse(text: string): CvDoc {
  // Normalise CRLF → LF so regexes anchored to end-of-line match correctly.
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];

  // Header: lines from start through the first `## ` or `---` boundary.
  let cursor = 0;
  const header = parseHeader(lines, cursor);
  sections.push(header.section);
  cursor = header.next;

  // Walk top-level `## ` sections.
  while (cursor < lines.length) {
    if (!lines[cursor].startsWith("## ")) {
      cursor++;
      continue;
    }
    const start = cursor;
    const title = lines[cursor].slice(3).trim();
    cursor++;
    while (
      cursor < lines.length &&
      !lines[cursor].startsWith("## ")
    ) {
      cursor++;
    }
    const body = lines.slice(start + 1, cursor).join("\n");
    sections.push(classify(title, body));
  }

  return { sections };
}

function parseHeader(
  lines: ReadonlyArray<string>,
  start: number,
): { section: HeaderSection; next: number } {
  let i = start;
  // Skip blank lines.
  while (i < lines.length && lines[i].trim() === "") i++;

  let name = "";
  if (i < lines.length && lines[i].startsWith("# ")) {
    name = lines[i].slice(2).trim();
    i++;
  }

  const contacts: ContactPair[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("## ")) break;
    if (line.trim() === "---") {
      i++;
      break;
    }
    const m = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
    if (m) {
      const label = m[1].trim();
      const rawValue = m[2].trim();
      const link = rawValue.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        contacts.push({ label, value: link[1], href: link[2] });
      } else {
        contacts.push({ label, value: rawValue });
      }
    }
    i++;
  }

  return { section: { kind: "header", name, contacts }, next: i };
}

function classify(title: string, body: string): Section {
  const key = title.toLowerCase().trim();
  if (PROSE_TITLES.has(key)) return parseProse(title, body);
  if (LIST_TITLES.has(key)) return parseList(title, body);
  if (EXPERIENCE_TITLES.has(key)) return parseExperience(title, body);
  if (EDUCATION_TITLES.has(key)) return parseEducation(title, body);
  return { kind: "raw", title, body: trimBoundary(body) };
}

function parseProse(title: string, body: string): ProseSection {
  return { kind: "prose", title, body: trimBoundary(body) };
}

function parseList(title: string, body: string): ListSection {
  const items: string[] = [];
  for (const raw of body.split("\n")) {
    const m = raw.match(/^\s*[-*]\s+(.*)$/);
    if (m) items.push(m[1].trim());
  }
  return { kind: "list", title, items };
}

function parseEducation(title: string, body: string): EducationSection {
  const entries: EducationEntry[] = [];
  // Education entries are blocks separated by blank lines. Each block:
  //   **School**
  //   Degree
  //   *Dates*  (optional)
  const blocks = splitBlankBlocks(trimBoundary(body));
  for (const block of blocks) {
    const lines = block.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const schoolMatch = lines[0].match(/^\*\*(.+)\*\*$/);
    if (!schoolMatch) continue;
    const school = schoolMatch[1].trim();
    const degree = lines[1] ?? "";
    const datesMatch = lines[2]?.match(/^\*(.+)\*$/);
    const dates = datesMatch ? datesMatch[1].trim() : undefined;
    entries.push({ school, degree, dates });
  }
  return { kind: "education", title, entries };
}

function parseExperience(title: string, body: string): ExperienceSection {
  const jobs: ExperienceJob[] = [];
  const cleanBody = trimBoundary(body);
  // Each job starts at a `### ` heading. Use a regex split that keeps the
  // delimiter as the start of the next chunk.
  const chunks = splitByHeading(cleanBody, /^###\s+/m);
  for (const chunk of chunks) {
    if (!chunk.startsWith("### ")) continue;
    jobs.push(parseJob(chunk));
  }
  return { kind: "experience", title, jobs };
}

function parseJob(chunk: string): ExperienceJob {
  const lines = chunk.split("\n");
  const headingLine = lines[0].replace(/^###\s+/, "").trim();
  // Split company and location on the first em-dash or " — ".
  let company = headingLine;
  let location: string | undefined;
  const dash = headingLine.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (dash) {
    company = dash[1].trim();
    location = dash[2].trim();
  }

  // Parse remaining lines until the first sub-engagement (`#### `) or end.
  let i = 1;
  let title: string | undefined;
  let dates: string | undefined;
  let context: string | undefined;
  let description: string | undefined;
  const bullets: string[] = [];
  const subs: ExperienceSub[] = [];

  // Helper: skip blank lines.
  const skipBlanks = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
  };

  // Title (first **bold** line).
  skipBlanks();
  if (i < lines.length) {
    const m = lines[i].match(/^\*\*(.+)\*\*$/);
    if (m) {
      title = m[1].trim();
      i++;
    }
  }

  // Dates (first *italic* line).
  skipBlanks();
  if (i < lines.length) {
    const m = lines[i].match(/^\*(.+)\*$/);
    if (m) {
      dates = m[1].trim();
      i++;
    }
  }

  // Optional second italic line = context.
  skipBlanks();
  if (i < lines.length) {
    const m = lines[i].match(/^\*(.+)\*$/);
    if (m) {
      context = m[1].trim();
      i++;
    }
  }

  // Description: prose lines until the first bullet, sub-engagement, or end.
  const descLines: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("#### ")) break;
    if (/^\s*[-*]\s+/.test(line)) break;
    descLines.push(line);
    i++;
  }
  const descBlock = descLines.join("\n").trim();
  if (descBlock) description = descBlock;

  // Bullets and sub-engagements interleave. Bullets at the top level go to
  // the parent job; bullets after a `#### ` heading go to that sub.
  let currentSub: ExperienceSub | null = null;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("#### ")) {
      // Start of a new sub-engagement.
      const heading = line.slice(5).trim();
      currentSub = { heading, dates: undefined, bullets: [] };
      subs.push(currentSub);
      i++;
      // Optional `*Dates*` immediately after.
      skipBlanks();
      if (i < lines.length) {
        const m = lines[i].match(/^\*(.+)\*$/);
        if (m) {
          currentSub.dates = m[1].trim();
          i++;
        }
      }
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      const item = bullet[1].trim();
      if (currentSub) currentSub.bullets.push(item);
      else bullets.push(item);
      i++;
      continue;
    }
    // Otherwise skip (blank line, stray prose).
    i++;
  }

  return { company, location, title, dates, context, description, bullets, subEngagements: subs };
}

function splitBlankBlocks(text: string): string[] {
  return text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
}

function splitByHeading(text: string, re: RegExp): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let buffer: string[] = [];
  for (const line of lines) {
    if (re.test(line)) {
      if (buffer.length) chunks.push(buffer.join("\n").trim());
      buffer = [line];
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length) chunks.push(buffer.join("\n").trim());
  return chunks;
}

/** Strip leading/trailing horizontal-rule lines and surrounding blank lines. */
function trimBoundary(body: string): string {
  return body
    .replace(/^\s*(?:---\s*\n)?\s*/, "")
    .replace(/\s*(?:\n\s*---\s*)?\s*$/, "")
    .replace(/^\n+|\n+$/g, "");
}

// ============ Serialization ============

export function serialize(doc: CvDoc): string {
  const blocks: string[] = [];
  for (const section of doc.sections) {
    blocks.push(serializeSection(section));
  }
  // Sections are separated by `\n\n---\n\n` (matches the source style).
  const out = blocks.join("\n\n---\n\n");
  return out.endsWith("\n") ? out : out + "\n";
}

function serializeSection(section: Section): string {
  switch (section.kind) {
    case "header":
      return serializeHeader(section);
    case "prose":
      return `## ${section.title}\n\n${section.body.trim()}`;
    case "list": {
      const lines = section.items.map((i) => `- ${i}`).join("\n");
      return `## ${section.title}\n\n${lines}`;
    }
    case "experience":
      return serializeExperience(section);
    case "education":
      return serializeEducation(section);
    case "raw":
      return `## ${section.title}\n\n${section.body.trim()}`;
  }
}

function serializeHeader(h: HeaderSection): string {
  const out: string[] = [];
  if (h.name) out.push(`# ${h.name}`);
  if (h.contacts.length) out.push("");
  for (const c of h.contacts) {
    if (c.href) {
      out.push(`**${c.label}:** [${c.value}](${c.href})`);
    } else {
      out.push(`**${c.label}:** ${c.value}`);
    }
  }
  return out.join("\n").replace(/\n+$/, "");
}

function serializeExperience(s: ExperienceSection): string {
  const parts = [`## ${s.title}`, ""];
  s.jobs.forEach((job, idx) => {
    if (idx > 0) parts.push("---", "");
    const heading = job.location ? `${job.company} — ${job.location}` : job.company;
    parts.push(`### ${heading}`, "");
    if (job.title) {
      parts.push(`**${job.title}**`, "");
    }
    if (job.dates) {
      parts.push(`*${job.dates}*`, "");
    }
    if (job.context) {
      parts.push(`*${job.context}*`, "");
    }
    if (job.description) {
      parts.push(job.description.trim(), "");
    }
    for (const b of job.bullets) {
      parts.push(`- ${b}`);
    }
    if (job.bullets.length) parts.push("");
    for (const sub of job.subEngagements) {
      parts.push(`#### ${sub.heading}`);
      if (sub.dates) parts.push(`*${sub.dates}*`);
      parts.push("");
      for (const b of sub.bullets) parts.push(`- ${b}`);
      parts.push("");
    }
  });
  return parts.join("\n").replace(/\n+$/, "");
}

function serializeEducation(s: EducationSection): string {
  const parts = [`## ${s.title}`, ""];
  s.entries.forEach((e, idx) => {
    if (idx > 0) parts.push("");
    parts.push(`**${e.school}**`);
    if (e.degree) parts.push(e.degree);
    if (e.dates) parts.push(`*${e.dates}*`);
  });
  return parts.join("\n").replace(/\n+$/, "");
}
