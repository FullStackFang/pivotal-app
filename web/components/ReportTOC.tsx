"use client";
import { useEffect, useRef, useState } from "react";
import type { ParsedReport, ParsedScoreRow } from "@/lib/data/reportParser";

type Tone = "sage" | "amber" | "oxblood" | "navy";

function scoreTone(n: number | null): Tone {
  if (n === null) return "navy";
  if (n >= 4) return "sage";
  if (n >= 3) return "amber";
  return "oxblood";
}

function ScoreMatrix({ rows }: { rows: ParsedScoreRow[] }) {
  if (rows.length === 0) return null;
  const max = 5;
  return (
    <div className="rt-matrix">
      <div className="rt-matrix-head">Block scores</div>
      <ul className="rt-matrix-list">
        {rows.map((row, idx) => {
          const num = row.scoreNum;
          const isAdj = row.block.toLowerCase().includes("red flag") || (num !== null && num < 0);
          const pct = num === null ? 0 : Math.max(0, Math.min(1, isAdj ? Math.abs(num) / 1.5 : num / max));
          return (
            <li key={idx} className="rt-matrix-row" data-global={row.isGlobal || undefined}>
              <span className="rt-matrix-label">
                {row.isGlobal ? <strong>{row.block}</strong> : row.block}
              </span>
              <span className="rt-matrix-track">
                <span
                  className="rt-matrix-fill"
                  data-tone={isAdj ? "oxblood" : scoreTone(num)}
                  style={{ width: `${pct * 100}%` }}
                />
              </span>
              <span className="rt-matrix-num" data-global={row.isGlobal || undefined}>
                {row.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ReportTOC({ parsed }: { parsed: ParsedReport }) {
  const [activeId, setActiveId] = useState<string>(parsed.sections[0]?.id ?? "");
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (parsed.sections.length === 0) return;
    const scroller =
      (document.querySelector(".report-page") as HTMLElement | null) ?? null;
    const root = scroller ?? document;

    const measure = () => {
      const offset = scroller ? scroller.scrollTop : window.scrollY;
      let active = parsed.sections[0]?.id ?? "";
      for (const s of parsed.sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const top = scroller
          ? rect.top - scroller.getBoundingClientRect().top + scroller.scrollTop
          : rect.top + window.scrollY;
        if (top - 120 <= offset) active = s.id;
      }
      setActiveId(active);
    };

    measure();

    const target = scroller ?? window;
    target.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      target.removeEventListener("scroll", measure as EventListener);
      window.removeEventListener("resize", measure);
    };
  }, [parsed.sections]);

  const onClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const scroller = document.querySelector(".report-page") as HTMLElement | null;
    if (scroller) {
      const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24;
      scroller.scrollTo({ top, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <aside ref={containerRef as React.RefObject<HTMLElement>} className="report-toc">
      <div className="rt-section">
        <div className="rt-head">Contents</div>
        <ol className="rt-list">
          {parsed.sections.map(s => (
            <li
              key={s.id}
              className="rt-item"
              data-active={s.id === activeId || undefined}
              data-coded={Boolean(s.code) || undefined}
            >
              <a href={`#${s.id}`} onClick={e => onClick(e, s.id)}>
                <span className="rt-code">{s.code ?? "·"}</span>
                <span className="rt-title">{s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <ScoreMatrix rows={parsed.scoreBreakdown} />
    </aside>
  );
}
