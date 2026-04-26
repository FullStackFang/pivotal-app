"use client";
import { useState } from "react";

export function Toolbar({ onFilter, onSearch }: {
  onFilter: (status: string | undefined) => void;
  onSearch: (q: string) => void;
}) {
  const [active, setActive] = useState<string>("All");
  const tabs = ["All", "Evaluated", "Applied", "Interview", "Offer"];
  return (
    <div className="toolbar">
      <div className="seg">
        {tabs.map(t => (
          <button key={t}
            className={active === t ? "is-on" : ""}
            onClick={() => { setActive(t); onFilter(t === "All" ? undefined : t); }}>
            {t}
          </button>
        ))}
      </div>
      <div className="search">
        <input placeholder="Filter by company, role, location…"
               onChange={e => onSearch(e.target.value)} />
      </div>
    </div>
  );
}
