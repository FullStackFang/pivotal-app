import chokidar, { FSWatcher } from "chokidar";
import path from "node:path";
import { CAREER_OPS_ROOT as DEFAULT_ROOT } from "../paths.js";
import { indexApplicationsFile, indexReportFile } from "./indexer.js";

function resolveRoot(): string {
  return process.env.CAREER_OPS_ROOT ?? DEFAULT_ROOT;
}
function resolveAppsFile(): string {
  return path.join(resolveRoot(), "data", "applications.md");
}
function resolveReportsDir(): string {
  return path.join(resolveRoot(), "reports");
}

let watcher: FSWatcher | null = null;
const debounce = new Map<string, NodeJS.Timeout>();

function debounced(key: string, fn: () => void) {
  const t = debounce.get(key); if (t) clearTimeout(t);
  debounce.set(key, setTimeout(() => { debounce.delete(key); fn(); }, 150));
}

export function startWatcher(): () => void {
  if (watcher) return () => stopWatcher();

  const appsFile = resolveAppsFile();
  const reportsDir = resolveReportsDir();

  watcher = chokidar.watch([appsFile, reportsDir], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on("add",    (p: string) => routeChange(p, appsFile, reportsDir));
  watcher.on("change", (p: string) => routeChange(p, appsFile, reportsDir));
  watcher.on("unlink", (p: string) => routeChange(p, appsFile, reportsDir));
  return () => stopWatcher();
}

function routeChange(p: string, appsFile: string, reportsDir: string) {
  if (p === appsFile) {
    debounced("apps", () => indexApplicationsFile());
  } else if (p.startsWith(reportsDir)) {
    debounced(`r:${p}`, () => indexReportFile(p));
  }
}

export function stopWatcher() {
  watcher?.close(); watcher = null;
  for (const t of debounce.values()) clearTimeout(t);
  debounce.clear();
}
