export function MetricsRow({ pipeline, avgScore, offers, responseRate }: {
  pipeline: number; avgScore: number; offers: number; responseRate: number;
}) {
  return (
    <div className="metrics">
      <div className="metric"><div className="lbl">Active pipeline</div><div className="val">{pipeline}<small>roles</small></div></div>
      <div className="metric"><div className="lbl">Avg score</div><div className="val">{avgScore.toFixed(2)}<small>/ 5.0</small></div></div>
      <div className="metric"><div className="lbl">Offers</div><div className="val">{offers}<small>active</small></div></div>
      <div className="metric"><div className="lbl">Response rate</div><div className="val">{responseRate.toFixed(0)}<small>%</small></div></div>
    </div>
  );
}
