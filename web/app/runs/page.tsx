import { listEvalRuns, listApplications, reportNumByUrl } from "@/lib/data/sqlite";
import { canonicalizeUrl, computeViewState, liveIdSet } from "@/lib/agent/runState";
import { RunsTable, type RunRow } from "@/components/RunsTable";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const rows = listEvalRuns({});
  const live = liveIdSet();
  const appsByReportNum = new Map<number, { company: string; role: string; score: number | null }>();
  for (const a of listApplications({})) {
    if (a.reportNum !== null) {
      appsByReportNum.set(a.reportNum, { company: a.company, role: a.role, score: a.score });
    }
  }
  const rawUrlMap = reportNumByUrl();
  const canonicalUrlMap = new Map<string, number>();
  for (const [u, n] of rawUrlMap) canonicalUrlMap.set(canonicalizeUrl(u), n);

  const initialRuns: RunRow[] = rows.map(r => {
    const viewState = computeViewState(r, live);
    const reportNum =
      r.resultNum ??
      rawUrlMap.get(r.url) ??
      canonicalUrlMap.get(canonicalizeUrl(r.url)) ??
      null;
    const app = reportNum !== null ? appsByReportNum.get(reportNum) : undefined;
    return {
      ...r,
      resultNum: reportNum,
      viewState,
      live: viewState === "attached",
      company: app?.company ?? null,
      role: app?.role ?? null,
      score: app?.score ?? null,
    };
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
