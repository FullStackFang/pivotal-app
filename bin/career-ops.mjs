#!/usr/bin/env node

/**
 * career-ops -- multi-purpose launcher for the career-ops job-search system.
 *
 * Usage:
 *   career-ops                       Show help
 *   career-ops serve [--port N]      Start the web UI on http://127.0.0.1:N (default 3000)
 *   career-ops scan                  Scan portals for new offers (delegates to scan.mjs)
 *   career-ops verify                Health-check the pipeline (delegates to verify-pipeline.mjs)
 *   career-ops doctor                Setup diagnostic (delegates to doctor.mjs)
 *
 * Data location:
 *   --data <path>                    Override CAREER_OPS_ROOT (otherwise auto-detected)
 *   $CAREER_OPS_ROOT                 Same effect as --data
 *
 *   Auto-detection (if --data and env are unset):
 *     1. <cwd>/cv.md exists           -> use <cwd>
 *     2. <cwd>/career-ops/ exists     -> use that subdir
 *     3. <package-root>/cv.md exists  -> developer mode (cloned repo)
 *     4. ~/.career-ops/                -> created on first use
 *
 * The launcher always spawns the underlying tools in a child process with
 * CAREER_OPS_ROOT exported, so `web/lib/paths.ts` and the `.mjs` scripts
 * agree on the data location regardless of how they were invoked.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");

function parseArgs(argv) {
  const out = { command: null, dataPath: null, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data" || arg === "-d") {
      out.dataPath = argv[++i];
    } else if (arg.startsWith("--data=")) {
      out.dataPath = arg.slice("--data=".length);
    } else if (!out.command) {
      out.command = arg;
    } else {
      out.rest.push(arg);
    }
  }
  return out;
}

function resolveDataRoot(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.CAREER_OPS_ROOT) return path.resolve(process.env.CAREER_OPS_ROOT);

  const cwd = process.cwd();
  if (existsSync(path.join(cwd, "cv.md"))) return cwd;

  const cwdSub = path.join(cwd, "career-ops");
  if (existsSync(cwdSub)) return cwdSub;

  if (existsSync(path.join(packageRoot, "cv.md"))) return packageRoot;

  const home = path.join(homedir(), ".career-ops");
  if (!existsSync(home)) mkdirSync(home, { recursive: true });
  return home;
}

function printHelp() {
  console.log(`career-ops -- AI job-search pipeline

Usage:
  career-ops <command> [--data <path>]

Commands:
  serve        Start the local web UI on http://127.0.0.1:3000
  scan         Scan job portals for new offers
  verify       Run pipeline health checks
  doctor       Setup diagnostic
  bridge       (placeholder) Hosted-webapp bridge -- not yet implemented

Run "career-ops <command> --help" for command-specific options.

Data dir resolution (in order):
  1. --data <path>             Explicit override
  2. $CAREER_OPS_ROOT           Environment variable
  3. <cwd>/cv.md exists         Use cwd
  4. <cwd>/career-ops/ exists   Use that subdir
  5. Developer mode (cloned)    Use the cloned repo root
  6. ~/.career-ops/             Created on first use

The data dir holds your cv.md, config/profile.yml, data/applications.md,
reports/, output/, and other career-ops state.`);
}

async function runChild(cmd, args, env, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
      cwd,
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) return reject(new Error(`Killed by ${signal}`));
      resolve(code ?? 0);
    });
  });
}

async function commandServe(rest, dataRoot) {
  const portArg = rest.find(a => a.startsWith("--port="));
  const port = portArg
    ? portArg.slice("--port=".length)
    : (process.env.PORT || "3000");

  const webDir = path.join(packageRoot, "web");
  if (!existsSync(path.join(webDir, ".next"))) {
    console.error(`career-ops: web UI is not built (no ${path.join(webDir, ".next")}).`);
    console.error(`If you cloned the repo, run: cd web && npm install && npm run build`);
    return 2;
  }

  console.log(`career-ops serve`);
  console.log(`  data: ${dataRoot}`);
  console.log(`  url:  http://127.0.0.1:${port}`);
  console.log("  (uses your local Claude Code subscription via subprocess)\n");

  return runChild(
    process.execPath,
    [path.join(webDir, "node_modules", "next", "dist", "bin", "next"), "start", "-p", port, "-H", "127.0.0.1"],
    { CAREER_OPS_ROOT: dataRoot },
    webDir,
  );
}

async function commandScript(scriptName, rest, dataRoot) {
  const scriptPath = path.join(packageRoot, scriptName);
  if (!existsSync(scriptPath)) {
    console.error(`career-ops: ${scriptName} is missing from package`);
    return 2;
  }
  return runChild(
    process.execPath,
    [scriptPath, ...rest],
    { CAREER_OPS_ROOT: dataRoot },
    dataRoot,
  );
}

async function main() {
  const { command, dataPath, rest } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  const dataRoot = resolveDataRoot(dataPath);

  switch (command) {
    case "serve":
      return commandServe(rest, dataRoot);
    case "scan":
      return commandScript("scan.mjs", rest, dataRoot);
    case "verify":
      return commandScript("verify-pipeline.mjs", rest, dataRoot);
    case "doctor":
      return commandScript("doctor.mjs", rest, dataRoot);
    case "bridge": {
      const bridgePath = path.join(packageRoot, "bin", "career-ops-bridge-stub.mjs");
      return runChild(process.execPath, [bridgePath, ...rest], {}, packageRoot);
    }
    default:
      console.error(`career-ops: unknown command "${command}"\n`);
      printHelp();
      return 1;
  }
}

main().then(code => process.exit(code)).catch(err => {
  console.error(err);
  process.exit(1);
});
