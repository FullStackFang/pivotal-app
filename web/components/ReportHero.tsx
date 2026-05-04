import type { ParsedReport } from "@/lib/data/reportParser";

function ScoreScale({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <div className="rh-scale" aria-label={`Score ${value} of ${max}`}>
      <div className="rh-scale-track">
        <div className="rh-scale-axis" />
        <div className="rh-scale-fill" style={{ width: `${pct * 100}%` }} />
        <div className="rh-scale-marker" style={{ left: `${pct * 100}%` }}>
          <span className="rh-scale-marker-dot" />
        </div>
      </div>
      <div className="rh-scale-ticks">
        {ticks.map(t => (
          <span key={t} className="rh-scale-tick" data-active={t === Math.round(value)}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReportHero({ parsed, num }: { parsed: ParsedReport; num: number }) {
  const { title, meta } = parsed;
  const score = meta.scoreValue;
  const scoreMax = meta.scoreMax ?? 5;
  const verdictWord = score === undefined
    ? null
    : score >= 4.3 ? "Strong match"
    : score >= 4.0 ? "Worth a serious look"
    : score >= 3.5 ? "Conditional"
    : score >= 3.0 ? "Marginal"
    : "Skip";

  return (
    <header className="report-hero">
      <div className="rh-mast" aria-hidden="true" />

      <div className="rh-meta-line">
        <span className="rh-id">Dossier · #{String(num).padStart(3, "0")}</span>
        {meta.date && <span className="rh-sep" aria-hidden>·</span>}
        {meta.date && <span className="rh-date">{meta.date}</span>}
        {meta.archetype && <span className="rh-sep" aria-hidden>·</span>}
        {meta.archetype && <span className="rh-arche">{meta.archetype}</span>}
      </div>

      <h1 className="rh-title">{title}</h1>

      <div className="rh-grid">
        <div className="rh-grid-main">
          {meta.url && (
            <a className="rh-url" href={meta.url} target="_blank" rel="noreferrer">
              <span className="rh-url-glyph" aria-hidden>↗</span>
              <span className="rh-url-text">{shortenUrl(meta.url)}</span>
            </a>
          )}

          <dl className="rh-defs">
            {meta.legitimacy && meta.legitimacyTier && (
              <>
                <dt>Legitimacy</dt>
                <dd>
                  <span className={`rh-chip rh-chip-${meta.legitimacyTier.tone}`}>
                    <span className="rh-chip-dot" aria-hidden />
                    {meta.legitimacyTier.label}
                  </span>
                </dd>
              </>
            )}
            {meta.pdf && (
              <>
                <dt>PDF</dt>
                <dd className="rh-pdf">{meta.pdf}</dd>
              </>
            )}
          </dl>
        </div>

        {score !== undefined && (
          <div className="rh-score">
            <div className="rh-score-num">
              <span className="rh-score-val">{score.toFixed(1)}</span>
              <span className="rh-score-den">/{scoreMax}</span>
            </div>
            <div className="rh-score-verdict">{verdictWord}</div>
            <ScoreScale value={score} max={scoreMax} />
          </div>
        )}
      </div>
    </header>
  );
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 60 ? u.pathname.slice(0, 57) + "…" : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}
