export function CommandBar() {
  return (
    <footer className="cmd">
      <span className="grp"><span className="k">/</span> Filter</span>
      <span className="grp"><span className="k">E</span> Evaluate</span>
      <span className="grp"><span className="k">R</span> Reports</span>
      <span className="right">
        <span className="grp"><span className="ok">●</span> claude · subscription</span>
      </span>
    </footer>
  );
}
