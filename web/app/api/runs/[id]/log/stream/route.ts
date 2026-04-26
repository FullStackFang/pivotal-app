import fs from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { getEvalRun } from "@/lib/data/sqlite";
import { resolveEvalRunsDir } from "@/lib/agent/runner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new Response("invalid id", { status: 400 });
  }
  const run = getEvalRun(id);
  if (!run) return new Response("not found", { status: 404 });

  // Path traversal guard.
  const evalRunsDir = path.resolve(resolveEvalRunsDir());
  const logPath = path.resolve(run.logPath);
  if (!logPath.startsWith(evalRunsDir + path.sep) && logPath !== evalRunsDir) {
    return new Response("forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let offset = 0;
      let watcher: FSWatcher | null = null;
      let livenessTimer: NodeJS.Timeout | null = null;
      let closed = false;

      const send = (event: string | null, data: unknown) => {
        if (closed) return;
        try {
          const prefix = event ? `event: ${event}\n` : "";
          controller.enqueue(encoder.encode(`${prefix}data: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (watcher) { try { watcher.close(); } catch { /* */ } watcher = null; }
        if (livenessTimer) { clearInterval(livenessTimer); livenessTimer = null; }
        try { controller.close(); } catch { /* */ }
      };

      // Stop on client disconnect.
      const onAbort = () => close();
      req.signal.addEventListener("abort", onAbort);

      // 1. Send existing content.
      try {
        if (fs.existsSync(logPath)) {
          const raw = fs.readFileSync(logPath, "utf8");
          offset = Buffer.byteLength(raw, "utf8");
          const lines = raw.split("\n");
          if (lines.length && lines[lines.length - 1] === "") lines.pop();
          for (const line of lines) send(null, { line });
        }
      } catch (e) {
        send("error", { message: (e as Error).message });
      }

      // 2. Watch for new content. Use polling because /mnt/c/ on WSL2
      //    doesn't reliably get inotify events.
      watcher = chokidar.watch(logPath, {
        usePolling: true,
        interval: 300,
        ignoreInitial: true,
      });
      watcher.on("add", () => readNew());
      watcher.on("change", () => readNew());

      function readNew() {
        if (closed) return;
        try {
          const stat = fs.statSync(logPath);
          if (stat.size <= offset) return;
          const fd = fs.openSync(logPath, "r");
          const len = stat.size - offset;
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, offset);
          fs.closeSync(fd);
          offset = stat.size;
          const text = buf.toString("utf8");
          const lines = text.split("\n");
          if (lines.length && lines[lines.length - 1] === "") lines.pop();
          for (const line of lines) send(null, { line });
        } catch (e) {
          send("error", { message: (e as Error).message });
        }
      }

      // 3. Periodically check whether the run has ended; close the stream
      //    when it transitions out of `running`.
      livenessTimer = setInterval(() => {
        const r = getEvalRun(id);
        if (!r || r.status !== "running") {
          // Drain any final bytes before closing.
          readNew();
          send("run-ended", { status: r?.status ?? "missing" });
          close();
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
