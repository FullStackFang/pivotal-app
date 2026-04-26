// Vitest's vite-based loader treats unknown query strings as cache busters,
// causing the module to re-evaluate. TypeScript doesn't resolve query
// suffixes, so for each cache-busted import the tests use we re-export the
// named types from the real `paths` module.
declare module "*/lib/paths.js?default-test" {
  export const CAREER_OPS_ROOT: string;
  export const APPLICATIONS_FILE: string;
  export const REPORTS_DIR: string;
  export const CV_FILE: string;
  export const OUTPUT_DIR: string;
  export const EVAL_RUNS_DIR: string;
  export const WEB_DIR: string;
  export const WEB_CACHE_DIR: string;
  export const SQLITE_FILE: string;
}
declare module "*/lib/paths.js?env-test" {
  export const CAREER_OPS_ROOT: string;
  export const APPLICATIONS_FILE: string;
  export const REPORTS_DIR: string;
  export const CV_FILE: string;
  export const OUTPUT_DIR: string;
  export const EVAL_RUNS_DIR: string;
  export const WEB_DIR: string;
  export const WEB_CACHE_DIR: string;
  export const SQLITE_FILE: string;
}
declare module "*/lib/paths.js?derived-test" {
  export const CAREER_OPS_ROOT: string;
  export const APPLICATIONS_FILE: string;
  export const REPORTS_DIR: string;
  export const CV_FILE: string;
  export const OUTPUT_DIR: string;
  export const EVAL_RUNS_DIR: string;
  export const WEB_DIR: string;
  export const WEB_CACHE_DIR: string;
  export const SQLITE_FILE: string;
}
