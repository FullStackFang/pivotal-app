export function Topbar({ session, evaluated, offers, avgScore }: {
  session: string; evaluated: number; offers: number; avgScore: number;
}) {
  const now = new Date();
  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark" /> career-ops</div>
      <div className="stat">SESSION <b className="num">{session}</b></div>
      <div className="stat live"><span className="pulse" /> READY</div>
      <div className="stat">EVALUATED <b className="num">{evaluated}</b></div>
      <div className="stat">OFFERS <b className="num">{offers}</b></div>
      <div className="stat">AVG SCORE <b className="num">{avgScore.toFixed(2)}</b></div>
      <div className="clock">{now.toISOString().slice(0,10)} · <b>{now.toTimeString().slice(0,5)}</b></div>
    </header>
  );
}
