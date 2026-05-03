# career-ops · web

A web UX on top of the existing career-ops CLI. Runs on your laptop, uses your
local Claude Code subscription for evaluations.

## What it gives you

- **Pipeline** at `/` — the dashboard from `mockups/pipeline.html`, fed by your real `data/applications.md`.
- **Evaluate** at `/evaluate` — paste a job URL, watch the agent stream progress live (SSE), auto-redirects to the new report.
- **Reports** at `/reports` and `/reports/[num]` — every evaluation rendered as markdown.

The CLI keeps working unchanged. Edit `data/applications.md` in another window
and the web UI picks it up via the file watcher.

## Run it

The recommended entry point is the `career-ops` launcher at the repo root:

```bash
npx career-ops serve
```

That starts the bundled web UI on `http://127.0.0.1:3000` and points it at the
right data directory (auto-detected from your cwd; override with `--data
<path>` or `CAREER_OPS_ROOT`). It spawns the local `claude` subprocess for
evaluations, so you use your existing Claude Code subscription.

For development inside this repo:

```bash
cd web
npm install
npm run build
npm start            # listens on :3000
```

Open http://localhost:3000.

## Multi-device access (optional, Cloudflare Tunnel + Access)

1. Install: `brew install cloudflared` (or your platform's equivalent)
2. Authenticate: `cloudflared tunnel login`
3. Create tunnel: `cloudflared tunnel create career-ops`
4. Route DNS: `cloudflared tunnel route dns career-ops career-ops.<yourdomain>`
5. Run the tunnel:
   ```
   cloudflared tunnel --url http://localhost:3000 run career-ops
   ```
6. In Cloudflare Zero Trust → Access → Applications, add a Self-hosted app
   for `career-ops.<yourdomain>` with a single rule: emails =
   your Google identity. Anyone else hitting the URL gets a login wall.

The laptop must be running `npm start` for evaluations to actually run. The
pipeline view is read-only and works whenever the tunnel and laptop are up.

## Architecture

See `../docs/superpowers/specs/2026-04-25-career-ops-web-app-design.md` for the
full design and `../docs/superpowers/plans/2026-04-25-career-ops-web-app.md`
for the build plan.

Quick map:

```
web/
├── app/                     # Next.js App Router
│   ├── layout.tsx           # Shell: Topbar + NavRail + CommandBar
│   ├── page.tsx             # Pipeline (default route)
│   ├── evaluate/page.tsx    # Paste URL + live stream
│   ├── reports/page.tsx     # Index of all reports
│   ├── reports/[num]/page.tsx
│   └── api/
│       ├── applications/    # GET — list with filters
│       ├── reports/[num]/   # GET — single report
│       ├── reindex/         # POST — force fullIndex()
│       └── evaluate/        # POST — SSE stream
├── components/              # All React UI
├── lib/
│   ├── paths.ts             # CAREER_OPS_ROOT and friends
│   ├── types.ts             # Application, Report, EvalEvent…
│   ├── data/
│   │   ├── markdown.ts      # parseApplications, parseReport
│   │   ├── sqlite.ts        # better-sqlite3 index
│   │   ├── indexer.ts       # full + incremental
│   │   └── watcher.ts       # chokidar → indexer
│   └── agent/
│       ├── progress.ts      # parse Claude stdout
│       └── runner.ts        # spawn `claude`, stream events
└── instrumentation.ts       # boot-time fullIndex + watcher
```

`CAREER_OPS_ROOT` resolution order (matches the `bin/career-ops.mjs`
launcher's logic):

1. Explicit `CAREER_OPS_ROOT` env var (or `--data <path>` passed to the launcher).
2. The current working directory, if it contains `cv.md`.
3. `<cwd>/career-ops/` if that subdirectory exists.
4. The cloned repo root (developer mode), if it contains `cv.md`.
5. `~/.career-ops/` as a per-user fallback (created on first use).

## Tests

```bash
npm test            # vitest unit/integration (lib/* and parsers)
npm run typecheck   # tsc --noEmit
npm run e2e         # playwright (TODO: not yet authored)
```

## How evaluations work

1. You paste a URL on `/evaluate`.
2. `POST /api/evaluate` spawns `claude -p "/career-ops <url>"` as a subprocess
   with the parent repo as cwd.
3. The subprocess output is streamed line-by-line over SSE. `Block N/M:`
   markers become progress events; `Writing report 0XX-...md` becomes a
   navigation event.
4. When the agent writes a new file in `reports/`, the chokidar watcher fires
   and the SQLite index updates within ~150ms.
5. The pipeline view sees the new row on next refresh; the evaluate page
   auto-navigates to the new report.

The agent uses your existing Claude Code subscription — no API keys, no
separate billing. The web app just gives you a button instead of a slash
command.
