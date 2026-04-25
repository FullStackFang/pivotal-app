# Career-ops Web App — Design

**Status:** Approved (brainstorming complete, awaiting plan)
**Date:** 2026-04-25
**Author:** Stephen Fang (with Claude)
**Scope:** Lean v1 — 3 screens (pipeline, evaluate, report viewer)

---

## 1. Goals and non-goals

### Goal
Add a personal, web-accessible UX on top of the existing career-ops CLI. The user should be able to open a URL on any device, see their job-search pipeline, paste a URL to start an evaluation, watch it stream live, and read the resulting report — without typing slash commands.

### Non-goals
- Multi-tenant SaaS. This is a single-user app gated by Cloudflare Access.
- Replacing the CLI. The CLI remains fully functional; the web app is a *second* face on the same data.
- Migrating data formats. Markdown files stay the source of truth. No converters.
- Mobile-tuned layouts in v1. Desktop-first; phone access works but is not polished.
- Web-side scan, CV editing, or PDF generation in v1. Those stay in the CLI for now.

### Success criteria
1. Pipeline page loads in <500ms with a 1000-row tracker.
2. `Paste URL → live progress → report rendered` works end-to-end without touching a terminal.
3. Running a CLI command (`claude` in another window) updates the web UI within 2 seconds.
4. The web app can be exposed publicly via Cloudflare Tunnel + Access, with only the user's Google identity allowed in.

---

## 2. Architecture

```
[ phone / browser anywhere ]
        │  https
        ▼
[ Cloudflare Access ]   ── allow only Stephen's Google identity
        │
        ▼
[ Cloudflare Tunnel ]   ── outbound-only connection from laptop
        │
        ▼
[ Next.js 15 on laptop ]
   ├── App Router pages (the UI)
   ├── /api/* route handlers (SSE streams + JSON)
   ├── lib/data/      → reads & writes existing markdown files
   ├── lib/agent/     → spawns `claude -p` subprocesses
   └── better-sqlite3 → index over the markdown for fast queries
        │  reads/writes
        ▼
[ existing career-ops files ]
   cv.md · data/applications.md · reports/ · portals.yml · modes/ · output/
```

### Runtime model
- **One process** runs on the user's laptop: `next start` (or `next dev`).
- **One outbound tunnel** (`cloudflared`) exposes that process publicly.
- **One identity gate** (Cloudflare Access) restricts access.
- The user's existing **Claude Code subscription** powers evaluations via subprocess invocation. No API keys, no separate billing.

### Why local-first
- Honors the Claude Code subscription license (single user, their own machine).
- Reuses the existing markdown-and-files data layer with zero migration.
- Eliminates the need for a hosted backend, database, or auth service.
- The CLI and web app naturally coexist because they read/write the same files.

### Trade-off accepted
The laptop must be on for evaluations to run. This is acceptable because (a) the user already only runs evaluations when actively job-searching, and (b) the pipeline view itself is read-only and works whenever the tunnel is up.

---

## 3. Stack

| Concern | Pick | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC) | Matches existing v0 projects in the workspace; one process for UI + API |
| Language | TypeScript (strict) | Schema safety across markdown ↔ SQLite ↔ UI |
| Styling | Tailwind 4 + shadcn/ui | Mockup translates directly; consistent with v0 stack |
| Index DB | better-sqlite3 | Synchronous, single file, perfect for one user |
| Markdown parse | gray-matter + remark + remark-gfm | Frontmatter + GFM tables (the tracker is a GFM table) |
| Markdown render | react-markdown + remark-gfm | Reports rendered as React |
| File watching | chokidar | Triggers index rebuild when CLI edits files |
| Streaming | Native Server-Sent Events | One-way agent → browser is sufficient; no WebSocket library |
| Agent runtime | `child_process.spawn('claude', …)` | Reuses subscription, no API key |
| Tunnel | Cloudflare Tunnel (`cloudflared`) | Free, outbound-only, identity gate built in |
| Auth | Cloudflare Access | Free for ≤50 users; ours is 1 |
| Tests | Vitest (unit/integration), Playwright (smoke) | Standard Next.js stack |

### Versions to pin
- Node ≥ 20 LTS
- Next.js 15.x
- React 19.x
- Tailwind 4.x
- TypeScript 5.x

---

## 4. Project layout

```
career-ops/                        # existing repo, unchanged
├── cv.md
├── data/applications.md
├── reports/
├── modes/
├── portals.yml
├── *.mjs                          # existing scripts, untouched
├── mockups/pipeline.html          # design mockup
├── docs/superpowers/specs/        # this spec lives here
└── web/                           # NEW — the Next.js app
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── app/
    │   ├── layout.tsx             # global shell, fonts, providers
    │   ├── globals.css
    │   ├── (dashboard)/
    │   │   ├── layout.tsx         # nav rail + topbar + command bar
    │   │   ├── page.tsx           # Pipeline (default route)
    │   │   ├── evaluate/page.tsx  # Paste URL + live stream
    │   │   └── reports/[num]/page.tsx
    │   └── api/
    │       ├── applications/route.ts
    │       ├── reports/[num]/route.ts
    │       ├── evaluate/route.ts          # SSE
    │       └── reindex/route.ts           # POST → force rebuild
    ├── lib/
    │   ├── paths.ts               # CAREER_OPS_ROOT, resolved once
    │   ├── data/
    │   │   ├── markdown.ts        # parseApplications, parseReport
    │   │   ├── sqlite.ts          # schema + queries
    │   │   ├── indexer.ts         # rebuild SQLite from files
    │   │   └── watcher.ts         # chokidar → indexer
    │   ├── agent/
    │   │   ├── runner.ts          # spawn claude, stream stdout
    │   │   └── progress.ts        # parse block markers
    │   └── types.ts               # Application, Report, EvalEvent
    ├── components/
    │   ├── PipelineTable.tsx
    │   ├── ScoreBar.tsx
    │   ├── StatusPill.tsx
    │   ├── DetailPanel.tsx
    │   ├── MetricsRow.tsx
    │   ├── Toolbar.tsx
    │   ├── NavRail.tsx
    │   ├── Topbar.tsx
    │   ├── CommandBar.tsx
    │   └── EvaluateLiveStream.tsx
    ├── tests/
    │   ├── fixtures/              # small markdown samples
    │   ├── data.test.ts
    │   ├── agent.test.ts
    │   └── e2e/
    │       └── happy-path.spec.ts # Playwright
    └── README.md                  # how to run + tunnel
```

The web app is a **subdirectory of the existing repo**, not a sibling. This keeps `web/` co-located with the data files it reads, and `process.cwd()` resolution stays simple.

`CAREER_OPS_ROOT` defaults to `path.resolve(__dirname, '..')` (one level up from `web/`). Overridable via env var for tests.

---

## 5. Data model

Markdown files are the source of truth. SQLite is a derived index, rebuildable at any time.

### SQLite schema

```sql
CREATE TABLE applications (
  num         INTEGER PRIMARY KEY,
  date        TEXT NOT NULL,        -- YYYY-MM-DD
  company     TEXT NOT NULL,
  role        TEXT NOT NULL,
  score       REAL,                 -- 0.0–5.0; null if not scored
  status      TEXT NOT NULL,        -- canonical state from templates/states.yml
  pdf_present INTEGER NOT NULL,     -- 0/1
  report_num  INTEGER,              -- FK-ish to reports.num
  notes       TEXT,
  source_line INTEGER NOT NULL,     -- line in data/applications.md
  updated_at  INTEGER NOT NULL      -- mtime of source file at index time
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_date   ON applications(date DESC);
CREATE INDEX idx_applications_score  ON applications(score DESC);

CREATE TABLE reports (
  num         INTEGER PRIMARY KEY,
  path        TEXT NOT NULL,        -- relative to repo root
  url         TEXT,                 -- the JD URL
  legitimacy  TEXT,                 -- Verified|Probable|Stale|Ghost
  scores_json TEXT,                 -- A–G breakdown as JSON
  body_md     TEXT NOT NULL,        -- full report markdown (cached)
  updated_at  INTEGER NOT NULL
);

CREATE TABLE eval_runs (
  id           TEXT PRIMARY KEY,    -- uuid
  url          TEXT NOT NULL,
  status       TEXT NOT NULL,       -- running|complete|failed
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  result_num   INTEGER,             -- the report.num produced, if any
  log_path     TEXT NOT NULL,       -- output/eval-runs/<id>.log
  error_msg    TEXT
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- meta keys: schema_version, last_full_index_at
```

### Boot sequence

1. Open `web/.cache/index.sqlite` (gitignored).
2. If `meta.schema_version` is missing or stale, drop and recreate tables.
3. Run **full indexer**: parse `data/applications.md`, glob `reports/*.md`, populate tables.
4. Start `chokidar` watching `data/applications.md`, `reports/`, `cv.md`.
5. On change events, run **incremental indexer** for the affected file(s).

### Indexer responsibilities

- `parseApplications(path)` → `Application[]` from the GFM table in `data/applications.md`.
- `parseReport(path)` → `Report` with frontmatter-like header parsing for `**URL:**`, `**Legitimacy:**`, score blocks.
- `reconcile(parsed, existing)` → upsert + delete-removed.
- Idempotent. Running twice on unchanged files is a no-op.

### Why an index, not just re-parse on each request

Re-parsing `data/applications.md` is cheap (it's one file), but `reports/` will accumulate hundreds of files and the dashboard wants sortable/filterable rows. SQLite gives us free indexing, full-text on notes if we want it later, and the boot-time rebuild is fast (≤ 100ms for 1000 rows).

---

## 6. Components and their interfaces

Each module has one job and a typed boundary. Internals can change without breaking consumers.

### `lib/data/markdown.ts`
```ts
export function parseApplications(filePath: string): ParsedApplication[];
export function parseReport(filePath: string): ParsedReport;
// Pure functions. No I/O side effects beyond reading the given file.
```

### `lib/data/sqlite.ts`
```ts
export function getDb(): Database;
export function listApplications(filter: AppFilter): Application[];
export function getReport(num: number): Report | null;
export function upsertApplication(app: Application): void;
export function upsertReport(report: Report): void;
// All synchronous. better-sqlite3 is sync by design.
```

### `lib/data/indexer.ts`
```ts
export function fullIndex(): IndexResult;
export function indexApplicationsFile(): IndexResult;
export function indexReportFile(path: string): IndexResult;
// IndexResult = { added, updated, removed, errors }
```

### `lib/data/watcher.ts`
```ts
export function startWatcher(): () => void; // returns stop()
// Internally calls indexer.* on change events with debouncing.
```

### `lib/agent/runner.ts`
```ts
export function runEvaluation(url: string): {
  events: AsyncIterable<EvalEvent>;
  runId: string;
};

export type EvalEvent =
  | { type: "started"; runId: string }
  | { type: "log"; line: string }
  | { type: "progress"; block: number; total: number; label: string }
  | { type: "report-written"; num: number; path: string }
  | { type: "tracker-updated" }
  | { type: "done"; runId: string; reportNum?: number }
  | { type: "error"; message: string; tail: string[] };
```

### `lib/agent/progress.ts`
```ts
export function parseClaudeLine(line: string): EvalEvent | null;
// Stateless line parser. Recognizes "Block N/M", "Writing report ###", etc.
```

### API routes

```
GET  /api/applications?status=&q=&limit=&offset=
GET  /api/reports/:num
POST /api/evaluate              { url }    → SSE stream of EvalEvent
POST /api/reindex                          → forces fullIndex()
```

---

## 7. Data flow walkthroughs

### 7.1 Pipeline view

1. Browser navigates to `/` (Pipeline).
2. Server component calls `listApplications({})` synchronously against SQLite.
3. Renders the mockup's table + metrics row.
4. Client component (`<PipelineTable>`) receives data via props; client-side filter/sort happens in-memory for a 1000-row dataset.

### 7.2 Evaluate (the core flow)

1. User opens `/evaluate`, pastes a URL, hits Run.
2. Browser opens an EventSource: `POST /api/evaluate` with `{ url }`.
3. Route handler:
   - Generates `runId` (uuid).
   - Inserts `eval_runs` row with `status='running'`.
   - Spawns `claude -p "/career-ops ${url}"` with `cwd=CAREER_OPS_ROOT`.
   - Tees stdout to `output/eval-runs/<runId>.log` AND streams parsed events via SSE.
4. Client UI shows: spinner with current block (`Block 4 of 6 · level strategy`), tail of log lines, elapsed time.
5. When the agent writes a new file in `reports/`, the watcher fires; the indexer adds the row to SQLite.
6. Runner emits `report-written`, then `done`.
7. Client navigates to `/reports/<num>`.

### 7.3 Report viewer

1. Browser navigates to `/reports/123`.
2. Server component calls `getReport(123)`.
3. Renders markdown via `react-markdown`, with custom renderers for the score block and legitimacy tier (matching the mockup's detail panel).

---

## 8. Error handling

| Failure | Behavior |
|---|---|
| `claude` binary not found | Server emits `error` SSE event with install instructions; UI shows actionable message |
| `claude` exits non-zero | SSE `error` event with last 20 stderr lines; `eval_runs.status='failed'`; UI shows retry |
| Markdown parse fails on a row | Skip row, log to console, store the parse error in `applications.notes` so the user can fix it |
| SQLite drift from files | "Reindex" button on the pipeline page calls `POST /api/reindex` |
| Two writes race (CLI editing while web app's spawned `claude` writes) | The web app never edits `data/applications.md` directly — it spawns the agent, which uses the existing tracker-merge flow. Same path the CLI uses today, so no new race surface. |
| Tunnel down | App still reachable on `localhost:3000` from the laptop itself |

We do **not** wrap every error in elaborate fallbacks or retries. Surface the actual error, give a retry button, move on.

---

## 9. Testing strategy

### Unit (Vitest)
- `lib/data/markdown.ts` against `tests/fixtures/applications.md` and `tests/fixtures/reports/*.md`.
- `lib/data/indexer.ts` reconciliation: add, update, remove, no-op idempotency.
- `lib/agent/progress.ts` line parser: every recognized pattern + unknown lines.

### Integration (Vitest + temp dir)
- `lib/data/watcher.ts` with a temp directory: write a fixture file, assert the row appears in SQLite within 200ms.
- API routes against a temp `CAREER_OPS_ROOT` with seeded fixtures.
- `lib/agent/runner.ts` with `child_process.spawn` mocked: feed canned stdout streams, assert correct `EvalEvent` sequence.

### E2E (Playwright)
One smoke test: open pipeline → see seeded rows → click report → see scores rendered. No exhaustive component testing.

### Out of scope for tests
- The actual `claude` subprocess. Mock at the boundary.
- Cloudflare Tunnel / Access. Trust the platform.

---

## 10. Migration and coexistence

There is no migration. First run:

```bash
cd web
npm install
npm run build
npm start                  # listens on :3000
cloudflared tunnel run …   # exposes :3000 publicly with Access in front
```

The Next.js app reads the existing files and indexes them. Running `claude /career-ops <url>` in another terminal continues to work; the watcher picks up the file changes.

If the user ever wants to nuke the index: delete `web/.cache/index.sqlite` and restart.

---

## 11. Out of scope for v1 (deferred)

These are real features but each deserves its own design pass:

- **Scan UI.** Queue + progress is its own subsystem.
- **CV editor.** Inline markdown editor with PDF preview later.
- **Web-side PDF generation.** Currently the CLI calls `generate-pdf.mjs`; the web app links to the resulting `output/*.pdf` file.
- **Interview prep / patterns / follow-ups screens.**
- **Multi-tenant anything.**
- **Mobile-tuned layouts.**

Each of these gets a follow-up spec when its time comes.

---

## 12. Open questions (non-blocking — pick during plan)

- Subprocess `claude` flag: `-p` with `--print` vs `--output-format json` vs piping stdin. Plan should test which gives the cleanest progress signal.
- Whether to include a thin "running runs" tray in the topbar so the user can see active evaluations from any page.
- Whether the index lives in `web/.cache/` (gitignored) or `~/.cache/career-ops/` (user-level).

These do not block the design; they're choices the implementation plan should resolve.

---

## 13. Appendix — what stays unchanged

The following files are not touched by this work:
- All existing `*.mjs` scripts (scan, generate-pdf, merge-tracker, etc.)
- `cv.md`, `config/profile.yml`, `modes/`, `portals.yml`, `data/applications.md`, `reports/`
- The Go-based `dashboard/` TUI
- The CLI integrations (`.claude/`, `.opencode/`, `.gemini/` command files)

The web app is purely additive.
