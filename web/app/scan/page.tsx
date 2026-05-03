import { listScanRuns } from "@/lib/data/sqlite";
import { readPortalSummary } from "@/lib/portalsRead";
import { ScanInterface } from "@/components/ScanInterface";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  const recent = listScanRuns({ limit: 1 });
  const lastRun = recent[0] ?? null;
  const portals = readPortalSummary();

  return (
    <ScanInterface
      initialLastRun={lastRun ? {
        id: lastRun.id,
        status: lastRun.status,
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        newPostings: lastRun.newPostings,
        errorMsg: lastRun.errorMsg,
      } : null}
      portals={portals}
    />
  );
}
