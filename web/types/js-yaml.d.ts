declare module "js-yaml" {
  export interface YAMLException extends Error {
    name: string;
    reason: string;
    mark?: { line: number; column: number; position: number };
  }
  export function load(input: string): unknown;
  export function dump(input: unknown, options?: Record<string, unknown>): string;
  const _default: { load: typeof load; dump: typeof dump };
  export default _default;
}
