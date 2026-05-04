// Calls the local Claude Code CLI to convert raw resume text into a
// structured CvDoc. Mirrors the existing project pattern of `claude -p` (see
// lib/agent/runner.ts) so we reuse Claude Code's own auth — no API key needed.
//
// The model is instructed to emit JSON inside a fenced block; we extract it
// server-side and validate with Zod. If the JSON doesn't match the schema or
// can't be parsed, we surface a clear error rather than guessing.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { CvDocSchema, type CvDocOutput } from "./cvSchema";

export interface IngestResult {
  doc: CvDocOutput;
  /** Raw stdout for debugging when validation fails. */
  rawOutput?: string;
}

const PROMPT_PREAMBLE = `You are a resume parser. Convert the resume text below into a single structured JSON document.

# Output requirements

Output exactly ONE fenced JSON code block of the form:

\`\`\`json
{ "sections": [ ... ] }
\`\`\`

Do not write anything else outside the fence. No commentary, no markdown explanations, no second example. Output the fence and nothing more.

# Schema

The JSON object has shape \`{ sections: Section[] }\`. Each section is one of:

- header — { kind: "header", name: string, contacts: ContactPair[] }
  ContactPair: { label: string, value: string, href: string | null }
  Use one ContactPair per visible contact line at the top of the resume.
  href is the URL when the value was a hyperlink, otherwise null.

- prose — { kind: "prose", title: string, body: string }
  For "Executive Summary", "Profile", "Objective", "About". body is plain prose, multi-paragraph allowed via blank lines.

- list — { kind: "list", title: string, items: string[] }
  For "Core Competencies", "Skills", "Areas of Expertise". One short phrase per item.

- experience — { kind: "experience", title: string, jobs: Job[] }
  Job: {
    company: string,
    location: string | null,
    title: string | null,
    dates: string | null,
    context: string | null,
    description: string | null,
    bullets: string[],
    subEngagements: Sub[]
  }
  Sub: { heading: string, dates: string | null, bullets: string[] }
  Use subEngagements ONLY when one umbrella role covers multiple distinct client engagements (advisory, consulting, fractional). For regular full-time jobs, leave subEngagements: [] and put achievements in bullets. Set unused optional fields to null, never omit them.

- education — { kind: "education", title: string, entries: Entry[] }
  Entry: { school: string, degree: string, dates: string | null }

- raw — { kind: "raw", title: string, body: string }
  For sections that don't fit the shapes above (markdown tables, certifications lists, "Previous Experience" tables, "Leadership / Community / Ventures"). Preserve the markdown verbatim in body.

# Extraction rules

- The first section MUST be the header.
- Preserve original phrasing. Do not paraphrase, invent metrics, or add numbers that aren't in the resume.
- If the resume uses "**Topic** – Description" bullet leaders, keep them.
- Keep date formatting as it appears ("Jan 2022 – Present", "2018 – 2022"). Do not normalize.
- Section title should match the resume's heading text (preserve casing).
- Order sections in the order they appear on the resume.
- Use null for unused optional fields, never omit them.
- If content genuinely doesn't fit a structured kind, use raw — do not lose information.

# Resume text

`;

export async function ingestResume(resumeText: string): Promise<IngestResult> {
  const prompt = PROMPT_PREAMBLE + resumeText;
  const stdout = await runClaude(prompt);
  const json = extractJson(stdout);
  const parsed = CvDocSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    const err = new Error(
      `Model output failed schema validation: ${issues}${parsed.error.issues.length > 3 ? ` (+${parsed.error.issues.length - 3} more)` : ""}`,
    );
    (err as Error & { rawOutput?: string }).rawOutput = stdout;
    throw err;
  }
  return { doc: parsed.data, rawOutput: stdout };
}

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Spawn from a temp dir so no project CLAUDE.md or skills bleed into the
    // model's context. The prompt itself is fully self-contained.
    const proc = spawn("claude", ["-p", prompt], {
      cwd: tmpdir(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "`claude` CLI not found in PATH. Install Claude Code (https://docs.anthropic.com/en/docs/claude-code) and ensure the binary is on PATH.",
          ),
        );
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const tail = stderr.trim().slice(-500) || stdout.trim().slice(-500) || "(no stderr)";
        reject(new Error(`\`claude -p\` exited with code ${code}. Last output: ${tail}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/** Extract the JSON body from the model's response, tolerant of preamble or trailing text. */
export function extractJson(stdout: string): unknown {
  // First try a fenced ```json block.
  const fence = stdout.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence) {
    return JSON.parse(fence[1]);
  }
  // Fallback: find the outermost {...} that JSON.parses cleanly.
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = stdout.slice(start, end + 1);
    return JSON.parse(candidate);
  }
  throw new Error(
    "Model output did not contain a JSON object. The Claude CLI may not be authenticated or returned an empty response.",
  );
}
