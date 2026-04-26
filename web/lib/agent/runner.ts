import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { CAREER_OPS_ROOT as DEFAULT_ROOT, EVAL_RUNS_DIR as DEFAULT_EVAL_RUNS_DIR } from "../paths.js";
import { parseClaudeLine } from "./progress.js";
import { insertEvalRun, updateEvalRun } from "../data/sqlite.js";
import type { EvalEvent } from "../types.js";

// Live in-memory registry: runId → ChildProcess. Used by future cancel UI;
// for now lets us see what's running without scraping `ps`.
const liveProcs = new Map<string, ChildProcess>();
export function listLiveRuns(): string[] {
  return Array.from(liveProcs.keys());
}
export function killRun(runId: string): boolean {
  const proc = liveProcs.get(runId);
  if (!proc) return false;
  proc.kill("SIGTERM");
  return true;
}

function resolveRoot(): string {
  return process.env.CAREER_OPS_ROOT ?? DEFAULT_ROOT;
}
function resolveEvalRunsDir(): string {
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

  // Persist the run so other tabs / curls can see it.
  try { insertEvalRun({ id: runId, url, logPath }); }
  catch (e) { console.warn("eval_runs insert failed:", (e as Error).message); }

  // Pass args as an array. spawn with array args does NOT invoke a shell,
  // so the URL inside the prompt string cannot trigger any shell interpolation.
  const proc = spawn("claude", ["-p", `/career-ops ${url}`], {
    cwd: resolveRoot(),
    env: process.env,
  });
  liveProcs.set(runId, proc);

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
    try {
      updateEvalRun(runId, {
        status,
        resultNum: lastReportNum,
        errorMsg,
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
