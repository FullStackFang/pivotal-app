import path from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Resolution order (matches docs/superpowers/specs / plan):
//   1. CAREER_OPS_ROOT env (set by `bin/career-ops.mjs` from --data flag too)
//   2. CWD itself, if it looks like a career-ops data dir (has cv.md)
//   3. <CWD>/career-ops/ if that subdir exists
//   4. Developer mode: repo root resolved relative to this file (has cv.md)
//   5. ~/.career-ops/ as a final per-user fallback
function resolveDataRoot(): string {
  if (process.env.CAREER_OPS_ROOT) {
    return path.resolve(process.env.CAREER_OPS_ROOT);
  }

  const cwd = process.cwd();
  if (existsSync(path.join(cwd, "cv.md"))) return cwd;

  const cwdSub = path.join(cwd, "career-ops");
  if (existsSync(cwdSub)) return cwdSub;

  const repoRoot = path.resolve(here, "..", "..");
  if (existsSync(path.join(repoRoot, "cv.md"))) return repoRoot;

  return path.join(homedir(), ".career-ops");
}

export const CAREER_OPS_ROOT: string = resolveDataRoot();

export const APPLICATIONS_FILE = path.join(CAREER_OPS_ROOT, "data", "applications.md");
export const REPORTS_DIR       = path.join(CAREER_OPS_ROOT, "reports");
export const CV_FILE           = path.join(CAREER_OPS_ROOT, "cv.md");
export const OUTPUT_DIR        = path.join(CAREER_OPS_ROOT, "output");
export const EVAL_RUNS_DIR     = path.join(OUTPUT_DIR, "eval-runs");
export const SCAN_RUNS_DIR     = path.join(OUTPUT_DIR, "scan-runs");
export const SCAN_HISTORY_FILE = path.join(CAREER_OPS_ROOT, "data", "scan-history.tsv");
export const PIPELINE_FILE     = path.join(CAREER_OPS_ROOT, "data", "pipeline.md");
export const PORTALS_FILE      = path.join(CAREER_OPS_ROOT, "portals.yml");

export const WEB_DIR       = path.resolve(here, "..");
export const WEB_CACHE_DIR = path.join(WEB_DIR, ".cache");
export const SQLITE_FILE   = path.join(WEB_CACHE_DIR, "index.sqlite");
