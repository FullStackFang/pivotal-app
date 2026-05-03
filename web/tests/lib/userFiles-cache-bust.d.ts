// Vitest's vite-based loader treats unknown query strings as cache busters,
// causing the module to re-evaluate. TypeScript doesn't resolve query
// suffixes, so for each cache-busted import the tests use we re-declare the
// names exported from the real `userFiles` module. This file must remain a
// pure ambient declaration (no top-level imports), otherwise the wildcard
// `declare module` blocks are ignored.

declare module "*/lib/data/userFiles.js?t=list" {
  export const listUserFiles: typeof import("../../lib/data/userFiles.js").listUserFiles;
}
declare module "*/lib/data/userFiles.js?t=tpl" {
  export const readUserFile: typeof import("../../lib/data/userFiles.js").readUserFile;
}
declare module "*/lib/data/userFiles.js?t=write" {
  export const writeUserFile: typeof import("../../lib/data/userFiles.js").writeUserFile;
  export const readUserFile: typeof import("../../lib/data/userFiles.js").readUserFile;
}
declare module "*/lib/data/userFiles.js?t=invalid" {
  export const writeUserFile: typeof import("../../lib/data/userFiles.js").writeUserFile;
}
declare module "*/lib/data/userFiles.js?t=comments" {
  export const writeUserFile: typeof import("../../lib/data/userFiles.js").writeUserFile;
  export const readUserFile: typeof import("../../lib/data/userFiles.js").readUserFile;
}
declare module "*/lib/data/userFiles.js?t=newline" {
  export const writeUserFile: typeof import("../../lib/data/userFiles.js").writeUserFile;
  export const readUserFile: typeof import("../../lib/data/userFiles.js").readUserFile;
}
declare module "*/lib/data/userFiles.js?t=md" {
  export const writeUserFile: typeof import("../../lib/data/userFiles.js").writeUserFile;
}
declare module "*/lib/data/userFiles.js?t=spec" {
  export const getUserFileSpec: typeof import("../../lib/data/userFiles.js").getUserFileSpec;
}
declare module "*/lib/data/userFiles.js?t=pristine" {
  export const listUserFiles: typeof import("../../lib/data/userFiles.js").listUserFiles;
  export const writeUserFile: typeof import("../../lib/data/userFiles.js").writeUserFile;
}
