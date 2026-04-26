import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { CAREER_OPS_ROOT as DEFAULT_ROOT, EVAL_RUNS_DIR as DEFAULT_EVAL_RUNS_DIR } from "../paths.js";
import { parseClaudeLine } from "./progress.js";
import {
  insertEvalRun,
  updateEvalRun,
  getEvalRun,
  listRunningEvalRuns,
  markOrphanDead,
} from "../data/sqlite.js";
import type { EvalEvent } from "../types.js";

// Live in-memory registry: runId → ChildProcess.
const liveProcs = new Map<string, ChildProcess>();
export function listLiveRuns(): string[] {
  return Array.from(liveProcs.keys());
}

// Runs the user has asked to kill. The exit handler reads this set so the
// recorded error_msg becomes "Killed by user" instead of the generic exit message.
const pendingKills = new Set<string>();

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM = process exists but we can't signal — still alive.
    // ESRCH = no such process — dead.
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export type KillOutcome = "killed" | "already-dead" | "not-running";

export function killRun(runId: string): KillOutcome {
  // Attached: signal the live process. Exit handler will record outcome.
  const proc = liveProcs.get(runId);
  if (proc) {
    pendingKills.add(runId);
    try { proc.kill("SIGTERM"); } catch { /* already exited */ }
    return "killed";
  }

  // Orphan: look up PID from DB, signal directly.
  const run = getEvalRun(runId);
  if (!run || run.status !== "running") return "not-running";

  if (run.pid !== null && isPidAlive(run.pid)) {
    try { process.kill(run.pid, "SIGTERM"); } catch { /* already exited */ }
    const pid = run.pid;
    setTimeout(() => {
      if (isPidAlive(pid)) {
        try { process.kill(pid, "SIGKILL"); } catch { /* nothing to kill */ }
      }
      // Best-effort: write the user-facing reason. markOrphanDead is a no-op
      // if the row is no longer 'running' (e.g., if the orphan-monitor beat us to it).
      markOrphanDead(runId, "Killed by user");
    }, 5000);
    return "killed";
  }

  // PID is null or already dead — the row just hasn't been reconciled yet.
  markOrphanDead(runId, "Killed by user");
  return "already-dead";
}

/**
 * Background sweep that reconciles orphan-alive runs whose PID has since died.
 * Runs every 5 seconds while the server is up.
 */
export function startOrphanMonitor(intervalMs: number = 5000): NodeJS.Timeout {
  return setInterval(() => {
    try {
      const liveIds = new Set(listLiveRuns());
      const running = listRunningEvalRuns();
      for (const run of running) {
        if (liveIds.has(run.id)) continue; // attached — its own exit handler owns lifecycle
        if (run.pid === null || !isPidAlive(run.pid)) {
          markOrphanDead(run.id);
        }
      }
    } catch (e) {
      console.warn("orphan-monitor tick failed:", (e as Error).message);
    }
  }, intervalMs);
}

function resolveRoot(): string {
  return process.env.CAREER_OPS_ROOT ?? DEFAULT_ROOT;
}
export function resolveEvalRunsDir(): string {
  return process.env.CAREER_OPS_ROOT
    ? path.join(process.env.CAREER_OPS_ROOT, "output", "eval-runs")
    : DEFAULT_EVAL_RUNS_DIR;
}

export function runEvaluation(url: string): {
  events: AsyncIterable<EvalEvent>;
  runId: string;
} {
  const runId = uuid();
  const evalRunsDir = resolveEvalRunsDir();
  fs.mkdirSync(evalRunsDir, { recursive: true });
  const logPath = path.join(evalRunsDir, `${runId}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  // Pass args as an array. spawn with array args does NOT invoke a shell,
  // so the URL inside the prompt string cannot trigger any shell interpolation.
  // stdio: explicitly close stdin (claude warns + waits 3s otherwise) and
  // pipe stdout/stderr so we can stream them.
  const proc = spawn("claude", ["-p", `/career-ops ${url}`], {
    cwd: resolveRoot(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  liveProcs.set(runId, proc);

  // Persist the run AFTER spawn so we can record the OS PID. The PID is what
  // lets a future server process detect whether this run is still alive.
  const pid = proc.pid ?? null;
  if (pid === null) {
    console.warn(`[runner] spawn returned no PID for run ${runId}; orphan detection will not work for this run`);
  }
  try { insertEvalRun({ id: runId, url, logPath, pid }); }
  catch (e) { console.warn("eval_runs insert failed:", (e as Error).message); }

  let lastReportNum: number | null = null;

  const stderrTail: string[] = [];
  const queue: EvalEvent[] = [{ type: "started", runId }];
  let resolveNext: ((v: EvalEvent | null) => void) | null = null;
  let finished = false;

  const push = (e: EvalEvent) => {
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(e); }
    else queue.push(e);
  };

  const handleLine = (line: string) => {
    logStream.write(line + "\n");
    push({ type: "log", line });
    const ev = parseClaudeLine(line);
    if (ev) {
      if (ev.type === "report-written") lastReportNum = ev.num;
      push(ev);
    }
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
  const recordOutcome = (status: "complete" | "failed", errorMsg: string | null) => {
    const wasKilled = pendingKills.delete(runId);
    const finalErr = wasKilled ? "Killed by user" : errorMsg;
    const finalStatus = wasKilled ? "failed" : status;
    try {
      updateEvalRun(runId, {
        status: finalStatus,
        resultNum: lastReportNum,
        errorMsg: finalErr,
      });
    } catch (e) {
      console.warn("eval_runs update failed:", (e as Error).message);
    }
    liveProcs.delete(runId);
  };

  proc.on("error", (e) => {
    push({ type: "error", message: e.message, tail: stderrTail });
    finished = true;
    recordOutcome("failed", e.message);
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
  });
  proc.on("exit", (code) => {
    if (buf.length) handleLine(buf); buf = "";
    if (code === 0) {
      push({ type: "done", runId });
      recordOutcome("complete", null);
    } else {
      const msg = `claude exited ${code}${stderrTail.length ? `: ${stderrTail.slice(-1)[0]}` : ""}`;
      push({ type: "error", message: msg, tail: stderrTail });
      recordOutcome("failed", msg);
    }
    finished = true;
    logStream.end();
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
  });

  const events: AsyncIterable<EvalEvent> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<EvalEvent>> {
          if (queue.length) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (finished) return Promise.resolve({ value: undefined as unknown as EvalEvent, done: true });
          return new Promise((resolve) => {
            resolveNext = (e) => {
              if (e === null) resolve({ value: undefined as unknown as EvalEvent, done: true });
              else resolve({ value: e, done: false });
            };
          });
        },
      };
    },
  };

  return { events, runId };
}
