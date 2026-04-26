export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { fullIndex }    = await import("./lib/data/indexer.js");
    const { startWatcher } = await import("./lib/data/watcher.js");
    const { sweepStaleEvalRuns } = await import("./lib/data/sqlite.js");

    fullIndex();
    startWatcher();

    // Any runs left in 'running' state are from a previous server process
    // that's no longer alive — mark them failed so the UI doesn't lie.
    const swept = sweepStaleEvalRuns();
    if (swept > 0) console.log(`[boot] swept ${swept} stale eval_runs`);
  }
}
