import type { EvalRun } from "../data/sqlite.js";
import { isPidAlive, listLiveRuns } from "./runner.js";

export type RunViewState =
  | "attached"
  | "orphan-alive"
  | "orphan-dead"
  | "complete"
  | "failed";

/**
 * Reduce a URL to a cheap canonical form so a run with tracking params
 * matches the same posting's report (which records the cleaner URL).
 * Strips query string and any trailing slash; lowercases host.
 *
 * Stays conservative: keeps the path, scheme, and host. We don't strip
 * fragments-or-anything-clever because most career sites need the path.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.host.toLowerCase();
    const path = u.pathname.replace(/\/$/, "");
    return `${u.protocol}//${host}${path}`;
  } catch {
    return raw.replace(/\?.*$/, "").replace(/\/$/, "");
  }
}

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
