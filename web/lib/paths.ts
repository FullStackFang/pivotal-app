import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const CAREER_OPS_ROOT: string =
  process.env.CAREER_OPS_ROOT ?? path.resolve(here, "..", "..");

export const APPLICATIONS_FILE = path.join(CAREER_OPS_ROOT, "data", "applications.md");
export const REPORTS_DIR       = path.join(CAREER_OPS_ROOT, "reports");
export const CV_FILE           = path.join(CAREER_OPS_ROOT, "cv.md");
export const OUTPUT_DIR        = path.join(CAREER_OPS_ROOT, "output");
export const EVAL_RUNS_DIR     = path.join(OUTPUT_DIR, "eval-runs");

export const WEB_DIR       = path.resolve(here, "..");
export const WEB_CACHE_DIR = path.join(WEB_DIR, ".cache");
export const SQLITE_FILE   = path.join(WEB_CACHE_DIR, "index.sqlite");
