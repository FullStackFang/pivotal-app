"use client";
import { useMemo, useState } from "react";
import type { Application, Report } from "@/lib/types";
import { PipelineTable } from "./PipelineTable";
import { Toolbar } from "./Toolbar";
import { MetricsRow } from "./MetricsRow";
import { DetailPanel } from "./DetailPanel";

export function PipelineView({ initialApplications }: { initialApplications: Application[] }) {
  const [apps] = useState(initialApplications);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const filtered = useMemo(() => apps.filter(a =>
    (!statusFilter || a.status === statusFilter) &&
    (!q || (a.company + a.role + a.notes).toLowerCase().includes(q.toLowerCase()))
  ), [apps, statusFilter, q]);

  const selected = selectedNum ? apps.find(a => a.num === selectedNum) ?? null : null;

  async function selectRow(num: number) {
    setSelectedNum(num);
    const res = await fetch(`/api/reports/${num}`);
    setReport(res.ok ? (await res.json()).report : null);
  }

  function clearSelection() {
    setSelectedNum(null);
    setReport(null);
  }

  const offers = apps.filter(a => a.status === "Offer").length;
  const scoredCount = apps.filter(a => a.score !== null).length;
  const avg = scoredCount
    ? apps.reduce((s, a) => s + (a.score ?? 0), 0) / scoredCount
    : 0;

  return (
    <div className="pipeline-shell">
      <div className="pipeline-main">
        <div className="head">
          <h1 className="title">Pipeline</h1>
          <p className="lede">A filter, not a feed. Below the 4.0 line is noise.</p>
          <MetricsRow pipeline={apps.length} avgScore={avg} offers={offers} responseRate={28} />
        </div>
        <Toolbar onFilter={setStatusFilter} onSearch={setQ} />
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3>{apps.length === 0 ? "No applications yet" : "No matches"}</h3>
              <p>
                {apps.length === 0
                  ? "Paste a job URL on the Evaluate page to start your pipeline."
                  : "Try clearing the filter or search."}
              </p>
            </div>
          ) : (
            <PipelineTable
              applications={filtered}
              selectedNum={selectedNum}
              onSelect={selectRow}
            />
          )}
        </div>
      </div>
      {selected && (
        <DetailPanel app={selected} report={report} onClose={clearSelection} />
      )}
    </div>
  );
}
