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

  const offers = apps.filter(a => a.status === "Offer").length;
  const scoredCount = apps.filter(a => a.score !== null).length;
  const avg = scoredCount
    ? apps.reduce((s, a) => s + (a.score ?? 0), 0) / scoredCount
    : 0;

  return (
    <>
      <div className="head">
        <h1 className="title">Pipeline</h1>
        <p className="lede">A filter, not a feed. Below the 4.0 line is noise.</p>
        <MetricsRow pipeline={apps.length} avgScore={avg} offers={offers} responseRate={28} />
      </div>
      <Toolbar onFilter={setStatusFilter} onSearch={setQ} />
      <div className="table-wrap">
        <PipelineTable applications={filtered} selectedNum={selectedNum} onSelect={selectRow} />
      </div>
      <DetailPanel app={selected} report={report} />
    </>
  );
}
