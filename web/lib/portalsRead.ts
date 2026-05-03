import { readFileSync, existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { PORTALS_FILE } from "./paths.js";

export interface PortalSummary {
  enabledCount: number;
  totalCount: number;
  apiTypes: string[];
  matchableCount: number;
}

interface PortalCompany {
  name?: string;
  enabled?: boolean;
  careers_url?: string;
  api?: string;
}

/**
 * Mirrors scan.mjs:detectApi — keep in sync if scan.mjs adds new portal types.
 */
function detectApiType(c: PortalCompany): string | null {
  if (c.api && c.api.includes("greenhouse")) return "Greenhouse";
  const url = c.careers_url ?? "";
  if (/jobs\.ashbyhq\.com\//.test(url)) return "Ashby";
  if (/jobs\.lever\.co\//.test(url)) return "Lever";
  if (/job-boards(?:\.eu)?\.greenhouse\.io\//.test(url)) return "Greenhouse";
  return null;
}

export function readPortalSummary(): PortalSummary {
  if (!existsSync(PORTALS_FILE)) {
    return { enabledCount: 0, totalCount: 0, apiTypes: [], matchableCount: 0 };
  }
  let cfg: { tracked_companies?: PortalCompany[] };
  try {
    cfg = parseYaml(readFileSync(PORTALS_FILE, "utf-8")) as { tracked_companies?: PortalCompany[] };
  } catch {
    return { enabledCount: 0, totalCount: 0, apiTypes: [], matchableCount: 0 };
  }
  const companies = cfg.tracked_companies ?? [];
  const enabled = companies.filter(c => c.enabled !== false);
  const types = new Set<string>();
  let matchable = 0;
  for (const c of enabled) {
    const t = detectApiType(c);
    if (t) { types.add(t); matchable++; }
  }
  return {
    enabledCount: enabled.length,
    totalCount: companies.length,
    apiTypes: Array.from(types).sort(),
    matchableCount: matchable,
  };
}
