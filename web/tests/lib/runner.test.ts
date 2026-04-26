import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { EvalEvent } from "../../lib/types.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

import { spawn } from "node:child_process";
import { runEvaluation } from "../../lib/agent/runner.js";

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

beforeEach(() => { vi.clearAllMocks(); });

describe("runEvaluation", () => {
  it("emits started, progress events, then done on exit 0", async () => {
    const fake = new FakeProc();
    (spawn as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fake);

    const { events, runId } = runEvaluation("https://example.com");
    expect(runId).toMatch(/[0-9a-f-]{36}/);

    const collected: EvalEvent[] = [];
    const consumer = (async () => { for await (const e of events) collected.push(e); })();

    setTimeout(() => {
      fake.stdout.emit("data", Buffer.from("Block 1/6: role summary\n"));
      fake.stdout.emit("data", Buffer.from("Block 2/6: cv match\n"));
      fake.emit("exit", 0);
    }, 10);

    await consumer;
    expect(collected[0]).toEqual({ type: "started", runId });
    expect(collected.some(e => e.type === "progress" && e.block === 1)).toBe(true);
    expect(collected.some(e => e.type === "progress" && e.block === 2)).toBe(true);
    expect(collected[collected.length - 1].type).toBe("done");
  });

  it("emits error event with stderr tail on non-zero exit", async () => {
    const fake = new FakeProc();
    (spawn as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fake);
    const { events } = runEvaluation("https://example.com");

    const collected: EvalEvent[] = [];
    const consumer = (async () => { for await (const e of events) collected.push(e); })();

    setTimeout(() => {
      fake.stderr.emit("data", Buffer.from("auth failed\n"));
      fake.emit("exit", 1);
    }, 10);

    await consumer;
    expect(collected.find(e => e.type === "error")).toBeTruthy();
  });

  it("calls spawn with arguments as an array (no shell injection)", () => {
    const fake = new FakeProc();
    (spawn as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(fake);
    runEvaluation("https://x.com/job?id=1&q=2");
    const call = (spawn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe("claude");
    expect(Array.isArray(call[1])).toBe(true);
    expect((call[1] as string[])[0]).toBe("-p");
    expect((call[1] as string[])[1]).toBe("/career-ops https://x.com/job?id=1&q=2");
  });
});
