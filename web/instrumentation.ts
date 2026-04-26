export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { fullIndex }    = await import("./lib/data/indexer.js");
    const { startWatcher } = await import("./lib/data/watcher.js");
    const { reconcileRunsOnBoot } = await import("./lib/data/sqlite.js");
    const { isPidAlive, startOrphanMonitor } = await import("./lib/agent/runner.js");

    fullIndex();
    startWatcher();

    const { swept, kept } = reconcileRunsOnBoot(isPidAlive);
    console.log(`[boot] eval_runs: swept ${swept} dead, kept ${kept} orphan-alive`);

    startOrphanMonitor();
  }
}
