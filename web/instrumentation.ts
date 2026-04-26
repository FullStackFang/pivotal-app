export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { fullIndex }    = await import("./lib/data/indexer.js");
    const { startWatcher } = await import("./lib/data/watcher.js");
    fullIndex();
    startWatcher();
  }
}
