export function ScoreBar({ score }: { score: number | null }) {
  const filled = score === null ? 0 : Math.floor(score);
  const partial = score === null ? 0 : score - Math.floor(score);
  const tone = score === null ? "muted" : score >= 4 ? "sage" : score >= 3 ? "amber" : "oxblood";
  return (
    <div className="score" data-tone={tone}>
      <span className="score-num">{score === null ? "—" : score.toFixed(1)}</span>
      <span className="score-bar">
        {Array.from({ length: 5 }, (_, i) => {
          const fill = i < filled ? "full" : i === filled && partial > 0 ? "partial" : "empty";
          return <i key={i} data-seg data-fill={fill} />;
        })}
      </span>
    </div>
  );
}
