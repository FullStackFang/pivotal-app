import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import {
  CAREER_OPS_ROOT as DEFAULT_ROOT,
  SCAN_RUNS_DIR as DEFAULT_SCAN_RUNS_DIR,
  SCAN_HISTORY_FILE as DEFAULT_SCAN_HISTORY_FILE,
} from "../paths.js";
import {
  insertScanRun,
  updateScanRun,
  getScanRun,
  listRunningScanRuns,
  markScanOrphanDead,
  type ScanRunPosting,
} from "../data/sqlite.js";
import { isPidAlive } from "./runner.js";
import type { ScanEvent } from "../types.js";

const liveScanProcs = new Map<string, ChildProcess>();
export function listLiveScanRuns(): string[] {
  return Array.from(liveScanProcs.keys());
}

const pendingScanKills = new Set<string>();

export type ScanKillOutcome = "killed" | "already-dead" | "not-running";

export function killScanRun(runId: string): ScanKillOutcome {
  const proc = liveScanProcs.get(runId);
  if (proc) {
    pendingScanKills.add(runId);
    try { proc.kill("SIGTERM"); } catch { /* already exited */ }
    return "killed";
  }

  const run = getScanRun(runId);
  if (!run || run.status !== "running") return "not-running";

  if (run.pid !== null && isPidAlive(run.pid)) {
    try { process.kill(run.pid, "SIGTERM"); } catch { /* already exited */ }
    const pid = run.pid;
    setTimeout(() => {
      if (isPidAlive(pid)) {
        try { process.kill(pid, "SIGKILL"); } catch { /* nothing to kill */ }
      }
      markScanOrphanDead(runId, "Killed by user");
    }, 5000);
    return "killed";
  }

  markScanOrphanDead(runId, "Killed by user");
  return "already-dead";
}

export function startScanOrphanMonitor(intervalMs: number = 5000): NodeJS.Timeout {
  return setInterval(() => {
    try {
      const liveIds = new Set(listLiveScanRuns());
      const running = listRunningScanRuns();
      for (const run of running) {
        if (liveIds.has(run.id)) continue;
        if (run.pid === null || !isPidAlive(run.pid)) {
          markScanOrphanDead(run.id);
        }
      }
    } catch (e) {
      console.warn("scan-orphan-monitor tick failed:", (e as Error).message);
    }
  }, intervalMs);
}

function resolveRoot(): string {
  return process.env.CAREER_OPS_ROOT ?? DEFAULT_ROOT;
}
function resolveScanRunsDir(): string {
  return process.env.CAREER_OPS_ROOT
    ? path.join(process.env.CAREER_OPS_ROOT, "output", "scan-runs")
    : DEFAULT_SCAN_RUNS_DIR;
}
function resolveScanHistoryFile(): string {
  return process.env.CAREER_OPS_ROOT
    ? path.join(process.env.CAREER_OPS_ROOT, "data", "scan-history.tsv")
    : DEFAULT_SCAN_HISTORY_FILE;
}

/**
 * Reads scan-history.tsv from `byteOffset` to EOF and returns rows that
 * scan.mjs marked as `added`. The TSV is append-only (scan.mjs:appendFileSync),
 * so the slice from the pre-scan offset captures exactly this scan's additions.
 *
 * TSV columns: url \t first_seen \t portal \t title \t company \t status
 */
function readPostingsAfter(byteOffset: number): ScanRunPosting[] {
  const tsvPath = resolveScanHistoryFile();
  if (!fs.existsSync(tsvPath)) return [];
  const stat = fs.statSync(tsvPath);
  if (stat.size <= byteOffset) return [];

  const fd = fs.openSync(tsvPath, "r");
  const buf = Buffer.alloc(stat.size - byteOffset);
  try {
    fs.readSync(fd, buf, 0, buf.length, byteOffset);
  } finally {
    fs.closeSync(fd);
  }

  const out: ScanRunPosting[] = [];
  for (const line of buf.toString("utf-8").split("\n")) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 6) continue;
    const [url, , , title, company, status] = cols;
    if (status !== "added") continue;
    if (!url || !company || !title) continue;
    out.push({ url, company, title });
  }
  return out;
}

export function runScan(opts: { priority?: boolean } = {}): {
  events: AsyncIterable<ScanEvent>;
  runId: string;
} {
  const runId = uuid();
  const scanRunsDir = resolveScanRunsDir();
  fs.mkdirSync(scanRunsDir, { recursive: true });
  const logPath = path.join(scanRunsDir, `${runId}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  const tsvPath = resolveScanHistoryFile();
  const sizeBefore = fs.existsSync(tsvPath) ? fs.statSync(tsvPath).size : 0;

  const args = ["scan.mjs"];
  if (opts.priority) args.push("--priority");

  const proc = spawn("node", args, {
    cwd: resolveRoot(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  liveScanProcs.set(runId, proc);

  const pid = proc.pid ?? null;
  if (pid === null) {
    console.warn(`[scan-runner] spawn returned no PID for run ${runId}`);
  }
  try { insertScanRun({ id: runId, logPath, pid, priority: opts.priority ?? false }); }
  catch (e) { console.warn("scan_runs insert failed:", (e as Error).message); }

  const stderrTail: string[] = [];
  const queue: ScanEvent[] = [{ type: "started", runId }];
  let resolveNext: ((v: ScanEvent | null) => void) | null = null;
  let finished = false;

  const push = (e: ScanEvent) => {
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(e); }
    else queue.push(e);
  };

  const handleLine = (line: string) => {
    logStream.write(line + "\n");
    push({ type: "log", line });
  };

  let buf = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      handleLine(line);
    }
  });
  proc.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    logStream.write(`[stderr] ${text}`);
    for (const line of text.split("\n")) {
      if (line) { stderrTail.push(line); if (stderrTail.length > 20) stderrTail.shift(); }
    }
  });

  const recordOutcome = (status: "complete" | "failed", errorMsg: string | null, newPostings: ScanRunPosting[]) => {
    const wasKilled = pendingScanKills.delete(runId);
    const finalErr = wasKilled ? "Killed by user" : errorMsg;
    const finalStatus = wasKilled ? "failed" : status;
    try {
      updateScanRun(runId, {
        status: finalStatus,
        newPostings,
        errorMsg: finalErr,
      });
    } catch (e) {
      console.warn("scan_runs update failed:", (e as Error).message);
    }
    liveScanProcs.delete(runId);
  };

  proc.on("error", (e) => {
    push({ type: "error", message: e.message, tail: stderrTail });
    finished = true;
    recordOutcome("failed", e.message, []);
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
  });
  proc.on("exit", (code) => {
    if (buf.length) handleLine(buf); buf = "";
    let postings: ScanRunPosting[] = [];
    try {
      postings = readPostingsAfter(sizeBefore);
    } catch (e) {
      console.warn("scan postings parse failed:", (e as Error).message);
    }
    if (code === 0) {
      push({ type: "done", runId, newPostings: postings });
      recordOutcome("complete", null, postings);
    } else {
      const msg = `scan.mjs exited ${code}${stderrTail.length ? `: ${stderrTail.slice(-1)[0]}` : ""}`;
      push({ type: "error", message: msg, tail: stderrTail });
      recordOutcome("failed", msg, postings);
    }
    finished = true;
    logStream.end();
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
  });

  const events: AsyncIterable<ScanEvent> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<ScanEvent>> {
          if (queue.length) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (finished) return Promise.resolve({ value: undefined as unknown as ScanEvent, done: true });
          return new Promise((resolve) => {
            resolveNext = (e) => {
              if (e === null) resolve({ value: undefined as unknown as ScanEvent, done: true });
              else resolve({ value: e, done: false });
            };
          });
        },
      };
    },
  };

  return { events, runId };
}
