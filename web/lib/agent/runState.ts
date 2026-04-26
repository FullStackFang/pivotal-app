import type { EvalRun } from "../data/sqlite.js";
import { isPidAlive, listLiveRuns } from "./runner.js";

export type RunViewState =
  | "attached"
  | "orphan-alive"
  | "orphan-dead"
  | "complete"
  | "failed";

/**
 * Computes the user-facing run state from (DB row, in-memory liveProcs, OS PID liveness).
 * Never persisted; cheap to recompute on every request.
 */
export function computeViewState(run: EvalRun, liveIds: Set<string>): RunViewState {
  if (run.status === "complete") return "complete";
  if (run.status === "failed")   return "failed";
  // status === "running"
  if (liveIds.has(run.id))                     return "attached";
  if (run.pid !== null && isPidAlive(run.pid)) return "orphan-alive";
  return "orphan-dead";
}

/** Snapshot helper used by API routes. */
export function liveIdSet(): Set<string> {
  return new Set(listLiveRuns());
}
