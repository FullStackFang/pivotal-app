import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseDocument, isMap, isSeq, YAMLMap, type Document } from "yaml";
import { PORTALS_FILE } from "./paths.js";
import { slugify, type PortalCompany } from "./portalsShared.js";

export type { PortalCompany } from "./portalsShared.js";
export { slugify } from "./portalsShared.js";

export interface PortalUpdate {
  enabled?: boolean;
  priority?: boolean;
}

export interface PortalAdd {
  name: string;
  careersUrl: string;
  priority?: boolean;
  notes?: string;
}

const TIER_1_NAMES = new Set([
  "bny",
  "blackrock",
  "morgan stanley",
  "jpmorgan chase",
  "goldman sachs",
  "citi",
]);

function detectApiType(careersUrl: string, apiField?: string): PortalCompany["apiType"] {
  if (apiField && apiField.includes("greenhouse")) return "Greenhouse";
  if (/jobs\.ashbyhq\.com\//.test(careersUrl)) return "Ashby";
  if (/jobs\.lever\.co\//.test(careersUrl)) return "Lever";
  if (/job-boards(?:\.eu)?\.greenhouse\.io\//.test(careersUrl)) return "Greenhouse";
  return null;
}

/**
 * Build the canonical Greenhouse board URL given a slug. Used when the user
 * pastes a board URL like https://job-boards.greenhouse.io/metropolis — we
 * keep that exact URL because scan.mjs's regex expects it.
 */

interface CompanyNode {
  name?: unknown;
  careers_url?: unknown;
  enabled?: unknown;
  priority?: unknown;
  notes?: unknown;
  api?: unknown;
}

function loadDoc(): Document | null {
  if (!existsSync(PORTALS_FILE)) return null;
  return parseDocument(readFileSync(PORTALS_FILE, "utf-8"));
}

function saveDoc(doc: Document): void {
  writeFileSync(PORTALS_FILE, doc.toString({ lineWidth: 0 }), "utf-8");
}

function getTrackedSeq(doc: Document) {
  const node = doc.get("tracked_companies");
  if (!isSeq(node)) return null;
  return node;
}

/**
 * Idempotently ensure every company has an explicit `priority` boolean.
 * Tier 1 (BNY, BlackRock, Morgan Stanley, JPMorgan Chase, Goldman Sachs, Citi)
 * defaults to true; everyone else to false. Writes back to disk only if any
 * field was missing.
 */
function ensurePriorityField(doc: Document): boolean {
  const seq = getTrackedSeq(doc);
  if (!seq) return false;
  let mutated = false;
  for (const item of seq.items) {
    if (!isMap(item)) continue;
    if (item.has("priority")) continue;
    const name = String(item.get("name") ?? "").toLowerCase().trim();
    item.set("priority", TIER_1_NAMES.has(name));
    mutated = true;
  }
  return mutated;
}

function nodeToCompany(item: YAMLMap): PortalCompany {
  const c = item.toJSON() as CompanyNode;
  const name = String(c.name ?? "");
  const careersUrl = String(c.careers_url ?? "");
  const apiField = c.api ? String(c.api) : undefined;
  const apiType = detectApiType(careersUrl, apiField);
  return {
    slug: slugify(name),
    name,
    careersUrl,
    enabled: c.enabled !== false,
    priority: c.priority === true,
    notes: c.notes ? String(c.notes) : null,
    apiType,
    matchable: apiType !== null,
  };
}

export interface ReadPortalsResult {
  companies: PortalCompany[];
  fileExists: boolean;
}

export function readPortals(): ReadPortalsResult {
  const doc = loadDoc();
  if (!doc) return { companies: [], fileExists: false };

  if (ensurePriorityField(doc)) saveDoc(doc);

  const seq = getTrackedSeq(doc);
  if (!seq) return { companies: [], fileExists: true };

  const companies: PortalCompany[] = [];
  for (const item of seq.items) {
    if (!isMap(item)) continue;
    companies.push(nodeToCompany(item));
  }
  return { companies, fileExists: true };
}

function findCompanyIndex(doc: Document, slug: string): number {
  const seq = getTrackedSeq(doc);
  if (!seq) return -1;
  for (let i = 0; i < seq.items.length; i++) {
    const item = seq.items[i];
    if (!isMap(item)) continue;
    const name = String(item.get("name") ?? "");
    if (slugify(name) === slug) return i;
  }
  return -1;
}

export function updateCompany(slug: string, patch: PortalUpdate): PortalCompany | null {
  const doc = loadDoc();
  if (!doc) return null;
  ensurePriorityField(doc);

  const seq = getTrackedSeq(doc);
  if (!seq) return null;
  const idx = findCompanyIndex(doc, slug);
  if (idx === -1) return null;

  const item = seq.items[idx];
  if (!isMap(item)) return null;

  if (typeof patch.enabled === "boolean") item.set("enabled", patch.enabled);
  if (typeof patch.priority === "boolean") item.set("priority", patch.priority);

  saveDoc(doc);
  return nodeToCompany(item);
}

export function deleteCompany(slug: string): boolean {
  const doc = loadDoc();
  if (!doc) return false;
  const seq = getTrackedSeq(doc);
  if (!seq) return false;
  const idx = findCompanyIndex(doc, slug);
  if (idx === -1) return false;
  seq.items.splice(idx, 1);
  saveDoc(doc);
  return true;
}

export function addCompany(c: PortalAdd): PortalCompany | { error: string } {
  if (!c.name?.trim()) return { error: "name required" };
  if (!c.careersUrl?.trim()) return { error: "careers_url required" };

  const slug = slugify(c.name);
  if (!slug) return { error: "name must contain alphanumeric characters" };

  const doc = loadDoc();
  if (!doc) return { error: "portals.yml not found" };
  ensurePriorityField(doc);

  const seq = getTrackedSeq(doc);
  if (!seq) return { error: "tracked_companies missing in portals.yml" };

  if (findCompanyIndex(doc, slug) !== -1) {
    return { error: `company "${c.name}" already exists` };
  }

  const map = new YAMLMap();
  map.set("name", c.name.trim());
  map.set("careers_url", c.careersUrl.trim());
  if (c.notes?.trim()) map.set("notes", c.notes.trim());
  map.set("enabled", true);
  map.set("priority", c.priority === true);

  seq.add(map);
  saveDoc(doc);
  return nodeToCompany(map);
}
