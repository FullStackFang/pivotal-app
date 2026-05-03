import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { CAREER_OPS_ROOT as DEFAULT_ROOT } from "../paths.js";

// Re-resolve the root from the env at call time so tests can inject a tmp dir.
// Falls back to the cached constant from paths.ts for production behaviour.
function dataRoot(): string {
  const fromEnv = process.env.CAREER_OPS_ROOT;
  return fromEnv ? path.resolve(fromEnv) : DEFAULT_ROOT;
}

export type UserFileKey =
  | "profile"
  | "cv"
  | "narrative"
  | "proof-points"
  | "portals";

export type UserFileFormat = "yaml" | "markdown";

export interface UserFileSpec {
  key: UserFileKey;
  /** Path relative to CAREER_OPS_ROOT. Never accepts arbitrary paths from the client. */
  relPath: string;
  format: UserFileFormat;
  label: string;
  /** One-line description shown in the UI. */
  description: string;
  /** Path to a template that seeds the file when missing. */
  templateRelPath?: string;
}

export const USER_FILES: Record<UserFileKey, UserFileSpec> = {
  profile: {
    key: "profile",
    relPath: "config/profile.yml",
    format: "yaml",
    label: "Profile",
    description: "Identity, target roles, compensation, and location.",
    templateRelPath: "config/profile.example.yml",
  },
  cv: {
    key: "cv",
    relPath: "cv.md",
    format: "markdown",
    label: "Resume",
    description: "Canonical CV. PDFs and evaluations read from this file.",
  },
  narrative: {
    key: "narrative",
    relPath: "modes/_profile.md",
    format: "markdown",
    label: "Narrative",
    description: "Archetypes, framing, skip rules, negotiation scripts.",
    templateRelPath: "modes/_profile.template.md",
  },
  "proof-points": {
    key: "proof-points",
    relPath: "article-digest.md",
    format: "markdown",
    label: "Proof points",
    description: "Compact achievements the agent reaches for during evaluations.",
  },
  portals: {
    key: "portals",
    relPath: "portals.yml",
    format: "yaml",
    label: "Portals",
    description: "Companies and queries swept by the scanner.",
    templateRelPath: "templates/portals.example.yml",
  },
};

export interface UserFileMeta extends UserFileSpec {
  exists: boolean;
  size: number;
  updatedAt: number | null;
  /** True when the file does not yet exist or matches the bundled template byte-for-byte. */
  isPristine: boolean;
}

export interface UserFileContent extends UserFileMeta {
  content: string;
}

function absolutePathFor(spec: UserFileSpec): string {
  // Resolve and confirm the result is still inside the data root — defence-in-depth
  // against path traversal even though only safelisted keys reach this code.
  const root = dataRoot();
  const abs = path.resolve(root, spec.relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Refusing to operate outside data root: ${spec.relPath}`);
  }
  return abs;
}

function readTemplate(spec: UserFileSpec): string | null {
  if (!spec.templateRelPath) return null;
  const abs = path.resolve(dataRoot(), spec.templateRelPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

export function getUserFileSpec(key: string): UserFileSpec | null {
  return Object.prototype.hasOwnProperty.call(USER_FILES, key)
    ? USER_FILES[key as UserFileKey]
    : null;
}

export function listUserFiles(): UserFileMeta[] {
  return (Object.values(USER_FILES) as UserFileSpec[]).map((spec) => meta(spec));
}

function meta(spec: UserFileSpec): UserFileMeta {
  const abs = absolutePathFor(spec);
  if (!fs.existsSync(abs)) {
    return { ...spec, exists: false, size: 0, updatedAt: null, isPristine: true };
  }
  const stat = fs.statSync(abs);
  let isPristine = false;
  const tpl = readTemplate(spec);
  if (tpl !== null) {
    const current = fs.readFileSync(abs, "utf8");
    isPristine = current === tpl;
  }
  return {
    ...spec,
    exists: true,
    size: stat.size,
    updatedAt: stat.mtimeMs,
    isPristine,
  };
}

export function readUserFile(key: UserFileKey): UserFileContent {
  const spec = USER_FILES[key];
  const abs = absolutePathFor(spec);
  const m = meta(spec);
  if (!m.exists) {
    const tpl = readTemplate(spec);
    return { ...m, content: tpl ?? "" };
  }
  const content = fs.readFileSync(abs, "utf8");
  return { ...m, content };
}

export interface WriteResult {
  ok: true;
  meta: UserFileMeta;
}

export interface WriteError {
  ok: false;
  error: string;
  /** Position of the YAML/markdown error when known, 1-indexed. */
  line?: number;
  column?: number;
}

export function writeUserFile(
  key: UserFileKey,
  content: string,
): WriteResult | WriteError {
  const spec = USER_FILES[key];

  if (spec.format === "yaml") {
    try {
      yaml.load(content);
    } catch (e: unknown) {
      const err = e as { message?: string; mark?: { line?: number; column?: number } };
      return {
        ok: false,
        error: err.message ?? "Invalid YAML.",
        line: typeof err.mark?.line === "number" ? err.mark.line + 1 : undefined,
        column: typeof err.mark?.column === "number" ? err.mark.column + 1 : undefined,
      };
    }
  }

  // Normalise line endings, ensure trailing newline (consistent with editor expectations).
  const normalised = content.replace(/\r\n/g, "\n");
  const finalContent = normalised.endsWith("\n") ? normalised : normalised + "\n";

  const abs = absolutePathFor(spec);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  // Atomic write: tmp file in same directory, then rename.
  const tmp = abs + `.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, finalContent, "utf8");
  fs.renameSync(tmp, abs);

  return { ok: true, meta: meta(spec) };
}
