"use client";
import type { Application } from "@/lib/types";
import { ScoreBar } from "./ScoreBar";
import { StatusPill } from "./StatusPill";

export function PipelineTable({
  applications, selectedNum, onSelect,
}: {
  applications: Application[];
  selectedNum: number | null;
  onSelect: (num: number) => void;
}) {
  return (
    <table className="apps">
      <thead>
        <tr>
          <th style={{ width: 46 }}>#</th>
          <th>Company</th>
          <th>Role</th>
          <th style={{ width: 120 }}>Score</th>
          <th style={{ width: 130 }}>Status</th>
          <th style={{ width: 90 }}>Date</th>
        </tr>
      </thead>
      <tbody>
        {applications.map(a => (
          <tr key={a.num}
              className={selectedNum === a.num ? "is-selected" : ""}
              onClick={() => onSelect(a.num)}>
            <td className="id">{String(a.num).padStart(3, "0")}</td>
            <td>
              <div className="co">
                <div className="logo">{a.company[0]}</div>
                <div className="co-name"><b>{a.company}</b></div>
              </div>
            </td>
            <td><div className="role">{a.role}</div></td>
            <td><ScoreBar score={a.score} /></td>
            <td><StatusPill status={a.status} /></td>
            <td className="date">{a.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
