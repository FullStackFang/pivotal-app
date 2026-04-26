import fs from "node:fs";
import path from "node:path";
import * as paths from "../paths.js";
import { parseApplications, parseReport } from "./markdown.js";
import {
  upsertApplication, deleteApplication, upsertReport,
  isOpen, openDb, listApplications,
} from "./sqlite.js";

export interface IndexResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

function ensureDb() {
  if (!isOpen()) openDb();
}

function resolveRoot(): string {
  return process.env.CAREER_OPS_ROOT ?? paths.CAREER_OPS_ROOT;
}

function resolveApplicationsFile(): string {
  return path.join(resolveRoot(), "data", "applications.md");
}

function resolveReportsDir(): string {
  return path.join(resolveRoot(), "reports");
}

export function indexApplicationsFile(filePath: string = resolveApplicationsFile()): IndexResult {
  ensureDb();
  const result: IndexResult = { added: 0, updated: 0, removed: 0, errors: [] };
  if (!fs.existsSync(filePath)) {
    result.errors.push(`Missing ${filePath}`);
    return result;
  }
  const parsed = parseApplications(filePath);
  const parsedNums = new Set(parsed.map(p => p.num));

  const existingNums = listApplications({}).map(a => a.num);
  for (const a of parsed) upsertApplication(a);
  for (const num of existingNums) {
    if (!parsedNums.has(num)) { deleteApplication(num); result.removed++; }
  }
  result.updated = parsed.length;
  return result;
}

export function indexReportFile(filePath: string): IndexResult {
  ensureDb();
  const result: IndexResult = { added: 0, updated: 0, removed: 0, errors: [] };
  try {
    const r = parseReport(filePath);
    upsertReport(r);
    result.updated = 1;
  } catch (e) {
    result.errors.push(`${filePath}: ${(e as Error).message}`);
  }
  return result;
}

export function fullIndex(): IndexResult {
  ensureDb();
  const merged: IndexResult = { added: 0, updated: 0, removed: 0, errors: [] };
  merge(merged, indexApplicationsFile());

  const reportsDir = resolveReportsDir();
  if (fs.existsSync(reportsDir)) {
    const files = fs.readdirSync(reportsDir)
      .filter(f => /^\d{3}-.*\.md$/.test(f))
      .map(f => path.join(reportsDir, f));
    for (const f of files) merge(merged, indexReportFile(f));
  }
  return merged;
}

function merge(into: IndexResult, from: IndexResult) {
  into.added   += from.added;
  into.updated += from.updated;
  into.removed += from.removed;
  into.errors.push(...from.errors);
}
