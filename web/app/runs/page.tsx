import { listEvalRuns } from "@/lib/data/sqlite";
import { computeViewState, liveIdSet } from "@/lib/agent/runState";
import { RunsTable, type RunRow } from "@/components/RunsTable";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const rows = listEvalRuns({});
  const live = liveIdSet();
  const initialRuns: RunRow[] = rows.map(r => {
    const viewState = computeViewState(r, live);
    return { ...r, viewState, live: viewState === "attached" };
  });
  const liveCount = initialRuns.filter(r =>
    r.viewState === "attached" || r.viewState === "orphan-alive"
  ).length;

  return (
    <div className="runs-page">
      <div className="head">
        <h1 className="title">
          Evaluation runs
          {liveCount > 0 && <em> · {liveCount} live</em>}
        </h1>
        <p className="lede">
          Every evaluation the agent has spawned. Live runs include orphaned ones from prior server processes — kill or re-run them from here.
        </p>
      </div>
      <div className="table-wrap">
        <RunsTable initialRuns={initialRuns} />
      </div>
    </div>
  );
}
