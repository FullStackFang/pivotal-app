# Career-ops Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal, web-accessible UX (pipeline / evaluate / report viewer) on top of the existing career-ops CLI, runnable on the user's laptop and exposable via Cloudflare Tunnel + Access.

**Architecture:** A new `web/` subdirectory in the existing repo holds a Next.js 15 app. Markdown files (`data/applications.md`, `reports/*.md`) remain the source of truth; a `better-sqlite3` index sits underneath for fast queries, rebuilt by a `chokidar` watcher when files change. Evaluations spawn the existing `claude` CLI as a subprocess (using Node's safe `spawn` API — never `exec`) and stream results back over Server-Sent Events. No backend service, no new database, no auth code — Cloudflare Access gates the tunnel URL.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript (strict), Tailwind 4, shadcn/ui, better-sqlite3, gray-matter + remark + remark-gfm, react-markdown, chokidar, Vitest, Playwright. Node ≥ 20.

**Spec:** `docs/superpowers/specs/2026-04-25-career-ops-web-app-design.md` is the authoritative architectural reference. Read it first.

---

## Pre-flight reading (do this once before starting)

1. Read the spec end-to-end: `docs/superpowers/specs/2026-04-25-career-ops-web-app-design.md`.
2. Skim `mockups/pipeline.html` — visual contract for the Pipeline screen and source of CSS tokens.
3. Skim `data/applications.md` and one file from `reports/` to understand input formats.
4. Confirm `claude --version` runs in the repo root.

All commands assume CWD is `<repo-root>/web` unless noted otherwise.

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/tailwind.config.ts`, `web/vitest.config.ts`, `web/playwright.config.ts`, `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/globals.css`, `web/.gitignore`
- Modify: root `.gitignore`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "career-ops-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "better-sqlite3": "^11.7.0",
    "chokidar": "^4.0.1",
    "gray-matter": "^4.0.3",
    "remark": "^15.0.1",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "unified": "^11.0.5",
    "react-markdown": "^9.0.1",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "@types/uuid": "^10.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "tests/e2e/**"]
}
```

- [ ] **Step 3: Create `web/next.config.ts`, `web/postcss.config.mjs`, `web/tailwind.config.ts`**

`web/next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "chokidar"],
};

export default nextConfig;
```

`web/postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`web/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 4: Create test config files**

`web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    globals: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
});
```

`web/playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 5: Create minimal app files**

`web/app/globals.css`:
```css
@import "tailwindcss";

:root { color-scheme: dark; }
html, body { margin: 0; padding: 0; background: #1a1611; color: #f3eee5; font-family: system-ui, sans-serif; }
```

`web/app/layout.tsx`:
```tsx
import "./globals.css";

export const metadata = { title: "career-ops" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`web/app/page.tsx`:
```tsx
export default function Home() {
  return <main style={{ padding: 24 }}>career-ops web — scaffolded</main>;
}
```

- [ ] **Step 6: Create `web/.gitignore` and patch root `.gitignore`**

`web/.gitignore`:
```
node_modules/
.next/
.cache/
out/
playwright-report/
test-results/
*.log
```

Append to root `.gitignore`:
```
web/node_modules/
web/.next/
web/.cache/
```

- [ ] **Step 7: Install and verify**

```bash
cd web
npm install
npm run typecheck
npm run build
```

Expected: typecheck and build both succeed.

- [ ] **Step 8: Commit**

```bash
git add web/.gitignore web/package.json web/tsconfig.json web/next.config.ts \
        web/postcss.config.mjs web/tailwind.config.ts web/vitest.config.ts \
        web/playwright.config.ts web/app/layout.tsx web/app/page.tsx \
        web/app/globals.css .gitignore
git commit -m "feat(web): scaffold Next.js 15 app with Tailwind, Vitest, Playwright"
```

---

## Task 2: Path resolution and shared types

**Files:**
- Create: `web/lib/paths.ts`, `web/lib/types.ts`, `web/tests/lib/paths.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/lib/paths.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";

describe("paths", () => {
  const original = process.env.CAREER_OPS_ROOT;
  afterEach(() => {
    if (original === undefined) delete process.env.CAREER_OPS_ROOT;
    else process.env.CAREER_OPS_ROOT = original;
  });

  it("defaults to a directory above web/", async () => {
    delete process.env.CAREER_OPS_ROOT;
    const mod = await import("../../lib/paths.js?default-test");
    expect(path.basename(mod.CAREER_OPS_ROOT)).not.toBe("web");
  });

  it("honors CAREER_OPS_ROOT env var", async () => {
    process.env.CAREER_OPS_ROOT = "/tmp/career-ops-fixture";
    const mod = await import("../../lib/paths.js?env-test");
    expect(mod.CAREER_OPS_ROOT).toBe("/tmp/career-ops-fixture");
  });

  it("derives APPLICATIONS_FILE and REPORTS_DIR", async () => {
    process.env.CAREER_OPS_ROOT = "/tmp/career-ops-fixture";
    const mod = await import("../../lib/paths.js?derived-test");
    expect(mod.APPLICATIONS_FILE).toBe("/tmp/career-ops-fixture/data/applications.md");
    expect(mod.REPORTS_DIR).toBe("/tmp/career-ops-fixture/reports");
  });
});
```

The `?default-test` / `?env-test` query suffixes are cache busters so each `import()` re-evaluates with the current env.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- paths
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `web/lib/paths.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const CAREER_OPS_ROOT: string =
  process.env.CAREER_OPS_ROOT ?? path.resolve(here, "..", "..");

export const APPLICATIONS_FILE = path.join(CAREER_OPS_ROOT, "data", "applications.md");
export const REPORTS_DIR       = path.join(CAREER_OPS_ROOT, "reports");
export const CV_FILE           = path.join(CAREER_OPS_ROOT, "cv.md");
export const OUTPUT_DIR        = path.join(CAREER_OPS_ROOT, "output");
export const EVAL_RUNS_DIR     = path.join(OUTPUT_DIR, "eval-runs");

export const WEB_DIR       = path.resolve(here, "..");
export const WEB_CACHE_DIR = path.join(WEB_DIR, ".cache");
export const SQLITE_FILE   = path.join(WEB_CACHE_DIR, "index.sqlite");
```

- [ ] **Step 4: Create `web/lib/types.ts`**

```ts
export type CanonicalStatus =
  | "Evaluated" | "Applied" | "Responded" | "Interview"
  | "Offer" | "Rejected" | "Discarded" | "SKIP";

export interface Application {
  num: number;
  date: string;
  company: string;
  role: string;
  score: number | null;
  status: CanonicalStatus | string;
  pdfPresent: boolean;
  reportNum: number | null;
  notes: string;
  sourceLine: number;
  updatedAt: number;
}

export interface ReportScores {
  A?: number; B?: number; C?: number; D?: number;
  E?: number; F?: number; G?: number;
}

export interface Report {
  num: number;
  path: string;
  url: string | null;
  legitimacy: string | null;
  scores: ReportScores;
  bodyMd: string;
  updatedAt: number;
}

export type EvalEvent =
  | { type: "started"; runId: string }
  | { type: "log"; line: string }
  | { type: "progress"; block: number; total: number; label: string }
  | { type: "report-written"; num: number; path: string }
  | { type: "tracker-updated" }
  | { type: "done"; runId: string; reportNum?: number }
  | { type: "error"; message: string; tail: string[] };

export interface AppFilter {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 5: Verify**

```bash
npm test -- paths
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/paths.ts web/lib/types.ts web/tests/lib/paths.test.ts
git commit -m "feat(web): path resolution and shared types"
```

---

## Task 3: Markdown parser — applications

**Files:**
- Create: `web/tests/fixtures/applications.md`, `web/tests/lib/markdown-applications.test.ts`, `web/lib/data/markdown.ts`

- [ ] **Step 1: Create the fixture**

`web/tests/fixtures/applications.md`:
```markdown
# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
| 41 | 2026-04-23 | Anthropic | Head of Applied AI, Enterprise | 4.8/5 | Interview | ✅ | [041](reports/041-anthropic-2026-04-23.md) | R3, warm intro via Liane |
| 40 | 2026-04-22 | OpenAI | Applied AI Lead, Platform | 4.2/5 | Applied | ✅ | [040](reports/040-openai-2026-04-22.md) | |
| 38 | 2026-04-19 | Retool | Head of AI Product | 3.8/5 | Evaluated | ✅ | [038](reports/038-retool-2026-04-19.md) | Hybrid 3d/wk |
| 36 | 2026-04-15 | Replit | Head of Agents Product | 3.4/5 | SKIP | ❌ | [036](reports/036-replit-2026-04-15.md) | Below 4.0 |
```

- [ ] **Step 2: Write the failing test**

`web/tests/lib/markdown-applications.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parseApplications } from "../../lib/data/markdown.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "../fixtures/applications.md");

describe("parseApplications", () => {
  it("parses every row of the GFM tracker table", () => {
    expect(parseApplications(fixture)).toHaveLength(4);
  });

  it("extracts num, date, company, role, score, status, pdf, report, notes", () => {
    const [first] = parseApplications(fixture);
    expect(first.num).toBe(41);
    expect(first.date).toBe("2026-04-23");
    expect(first.company).toBe("Anthropic");
    expect(first.role).toBe("Head of Applied AI, Enterprise");
    expect(first.score).toBe(4.8);
    expect(first.status).toBe("Interview");
    expect(first.pdfPresent).toBe(true);
    expect(first.reportNum).toBe(41);
    expect(first.notes).toBe("R3, warm intro via Liane");
  });

  it("treats ❌ as pdfPresent=false", () => {
    const replit = parseApplications(fixture).find(a => a.company === "Replit")!;
    expect(replit.pdfPresent).toBe(false);
  });

  it("populates sourceLine matching the line in the file", () => {
    expect(parseApplications(fixture)[0].sourceLine).toBe(5);
  });

  it("returns empty array if no rows", () => {
    const empty = path.join(here, "../fixtures/empty.md");
    fs.writeFileSync(empty, "# nothing here\n");
    expect(parseApplications(empty)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- markdown-applications
```

Expected: FAIL.

- [ ] **Step 4: Implement `parseApplications`**

`web/lib/data/markdown.ts`:
```ts
import fs from "node:fs";
import { Application, CanonicalStatus } from "../types.js";

const TABLE_HEADER_RE = /^\|\s*#\s*\|\s*Date\s*\|/i;

export function parseApplications(filePath: string): Application[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const lines = raw.split("\n");
  const rows: Application[] = [];

  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTable && TABLE_HEADER_RE.test(line)) {
      inTable = true;
      i++;
      continue;
    }
    if (!inTable) continue;
    if (!line.trim().startsWith("|")) { inTable = false; continue; }

    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    if (cells.length < 9) continue;

    const [numS, date, company, role, scoreS, status, pdfS, reportLink, notes] = cells;
    const num = parseInt(numS, 10);
    if (Number.isNaN(num)) continue;

    const scoreMatch = scoreS.match(/(\d+(?:\.\d+)?)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
    const reportNumMatch = reportLink.match(/\[(\d+)\]/);
    const reportNum = reportNumMatch ? parseInt(reportNumMatch[1], 10) : null;

    rows.push({
      num, date, company, role, score,
      status: status as CanonicalStatus,
      pdfPresent: pdfS.includes("✅"),
      reportNum, notes,
      sourceLine: i + 1,
      updatedAt: stat.mtimeMs,
    });
  }
  return rows;
}
```

- [ ] **Step 5: Verify**

```bash
npm test -- markdown-applications
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/data/markdown.ts web/tests/fixtures/applications.md \
        web/tests/fixtures/empty.md web/tests/lib/markdown-applications.test.ts
git commit -m "feat(web): parse applications.md into typed rows"
```

---

## Task 4: Markdown parser — reports

**Files:**
- Create: `web/tests/fixtures/reports/041-anthropic-2026-04-23.md`, `web/tests/lib/markdown-report.test.ts`
- Modify: `web/lib/data/markdown.ts`

- [ ] **Step 1: Create the fixture**

`web/tests/fixtures/reports/041-anthropic-2026-04-23.md`:
```markdown
# Anthropic — Head of Applied AI, Enterprise

**Score:** 4.8/5
**URL:** https://anthropic.com/careers/head-applied-ai
**PDF:** ✅ output/041-anthropic.pdf
**Legitimacy:** Verified

## Block A — Role & Scope (4.8)
Strong scope alignment.

## Block B — CV Match (4.7)
Direct match on agentic eval pipelines.

## Block C — Level & Trajectory (4.9)
L7 expectations align.

## Block D — Compensation (4.5)
Equity midpoint clears target.

## Block E — Personal Fit (3.9)
Hybrid 2d/wk SF. Yellow flag.

## Block F — Interview Readiness (4.8)
STAR+R bank covers expected behaviorals.

## Block G — Posting Legitimacy (5.0)
Verified — direct careers page.
```

- [ ] **Step 2: Write the failing test**

`web/tests/lib/markdown-report.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReport } from "../../lib/data/markdown.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "../fixtures/reports/041-anthropic-2026-04-23.md");

describe("parseReport", () => {
  const r = parseReport(fixture);

  it("derives num from filename", () => expect(r.num).toBe(41));
  it("captures URL", () => expect(r.url).toBe("https://anthropic.com/careers/head-applied-ai"));
  it("captures legitimacy", () => expect(r.legitimacy).toBe("Verified"));
  it("extracts A–G score scalars", () => {
    expect(r.scores.A).toBe(4.8);
    expect(r.scores.B).toBe(4.7);
    expect(r.scores.G).toBe(5.0);
  });
  it("returns full body markdown", () => expect(r.bodyMd).toMatch(/Block A — Role & Scope/));
  it("stores absolute path ending with the filename", () => {
    expect(r.path.endsWith("041-anthropic-2026-04-23.md")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- markdown-report
```

Expected: FAIL.

- [ ] **Step 4: Implement `parseReport`**

Append to `web/lib/data/markdown.ts`:
```ts
import path from "node:path";
import { Report, ReportScores } from "../types.js";

const NUM_FROM_FILENAME = /^(\d{3})-/;
const URL_LINE          = /^\*\*URL:\*\*\s*(.+)$/m;
const LEGIT_LINE        = /^\*\*Legitimacy:\*\*\s*(.+)$/m;
const BLOCK_HEADING     = /^##\s+Block\s+([A-G])\b[^(]*\((\d+(?:\.\d+)?)\)/gm;

export function parseReport(filePath: string): Report {
  const raw  = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const base = path.basename(filePath);
  const numMatch = base.match(NUM_FROM_FILENAME);
  if (!numMatch) throw new Error(`Cannot derive num from filename: ${base}`);

  const urlMatch   = raw.match(URL_LINE);
  const legitMatch = raw.match(LEGIT_LINE);

  const scores: ReportScores = {};
  for (const m of raw.matchAll(BLOCK_HEADING)) {
    const key = m[1] as keyof ReportScores;
    scores[key] = parseFloat(m[2]);
  }

  return {
    num: parseInt(numMatch[1], 10),
    path: filePath,
    url: urlMatch?.[1].trim() ?? null,
    legitimacy: legitMatch?.[1].trim() ?? null,
    scores,
    bodyMd: raw,
    updatedAt: stat.mtimeMs,
  };
}
```

- [ ] **Step 5: Verify**

```bash
npm test -- markdown-report
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/data/markdown.ts web/tests/fixtures/reports/041-anthropic-2026-04-23.md \
        web/tests/lib/markdown-report.test.ts
git commit -m "feat(web): parse report files into typed objects"
```

---

## Task 5: SQLite schema + queries

**Files:**
- Create: `web/lib/data/sqlite.ts`, `web/tests/lib/sqlite.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/lib/sqlite.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { openDb, listApplications, upsertApplication, getReport, upsertReport } from "../../lib/data/sqlite.js";
import type { Application, Report } from "../../lib/types.js";

function fakeApp(num: number, status = "Applied", score: number | null = 4.0): Application {
  return {
    num, date: "2026-04-20", company: "Acme", role: "Engineer",
    score, status, pdfPresent: true, reportNum: num,
    notes: "", sourceLine: num + 4, updatedAt: Date.now(),
  };
}
function fakeReport(num: number): Report {
  return {
    num, path: `/tmp/${num}.md`, url: "https://x", legitimacy: "Verified",
    scores: { A: 4.5, B: 4.0, G: 5.0 }, bodyMd: "# r", updatedAt: Date.now(),
  };
}

describe("sqlite", () => {
  beforeEach(() => { openDb(":memory:"); });

  it("upserts and lists applications", () => {
    upsertApplication(fakeApp(1));
    upsertApplication(fakeApp(2, "Offer", 4.6));
    expect(listApplications({})).toHaveLength(2);
  });

  it("filters by status", () => {
    upsertApplication(fakeApp(1, "Applied"));
    upsertApplication(fakeApp(2, "Offer"));
    expect(listApplications({ status: "Offer" })).toHaveLength(1);
  });

  it("filters by query against company/role/notes", () => {
    upsertApplication({ ...fakeApp(1), company: "Anthropic", role: "Head of AI" });
    upsertApplication({ ...fakeApp(2), company: "OpenAI", role: "Engineer" });
    expect(listApplications({ q: "anth" })).toHaveLength(1);
  });

  it("orders by date desc by default", () => {
    upsertApplication({ ...fakeApp(1), date: "2026-01-01" });
    upsertApplication({ ...fakeApp(2), date: "2026-04-01" });
    expect(listApplications({})[0].num).toBe(2);
  });

  it("upserts and gets reports with parsed scores", () => {
    upsertReport(fakeReport(41));
    const r = getReport(41);
    expect(r?.scores.A).toBe(4.5);
    expect(r?.legitimacy).toBe("Verified");
  });

  it("getReport returns null for unknown num", () => {
    expect(getReport(999)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- sqlite
```

Expected: FAIL.

- [ ] **Step 3: Implement `web/lib/data/sqlite.ts`**

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SQLITE_FILE } from "../paths.js";
import type { Application, Report, AppFilter } from "../types.js";

const SCHEMA_VERSION = "1";
let db: Database.Database | null = null;

export function openDb(file: string = SQLITE_FILE): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function getDbInternal(): Database.Database {
  if (!db) openDb();
  return db!;
}

function ensureSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS applications (
      num INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      score REAL,
      status TEXT NOT NULL,
      pdf_present INTEGER NOT NULL,
      report_num INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      source_line INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_date   ON applications(date DESC);
    CREATE INDEX IF NOT EXISTS idx_applications_score  ON applications(score DESC);

    CREATE TABLE IF NOT EXISTS reports (
      num INTEGER PRIMARY KEY,
      path TEXT NOT NULL,
      url TEXT,
      legitimacy TEXT,
      scores_json TEXT NOT NULL DEFAULT '{}',
      body_md TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eval_runs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      result_num INTEGER,
      log_path TEXT NOT NULL,
      error_msg TEXT
    );
  `);

  const cur = d.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value: string } | undefined;
  if (!cur) d.prepare("INSERT INTO meta(key,value) VALUES ('schema_version', ?)").run(SCHEMA_VERSION);
  else if (cur.value !== SCHEMA_VERSION) throw new Error(`Unexpected schema version ${cur.value}`);
}

const UPSERT_APP = `
  INSERT INTO applications(num,date,company,role,score,status,pdf_present,report_num,notes,source_line,updated_at)
  VALUES (@num,@date,@company,@role,@score,@status,@pdf_present,@report_num,@notes,@source_line,@updated_at)
  ON CONFLICT(num) DO UPDATE SET
    date=excluded.date, company=excluded.company, role=excluded.role,
    score=excluded.score, status=excluded.status, pdf_present=excluded.pdf_present,
    report_num=excluded.report_num, notes=excluded.notes,
    source_line=excluded.source_line, updated_at=excluded.updated_at
`;

export function upsertApplication(a: Application): void {
  getDbInternal().prepare(UPSERT_APP).run({
    num: a.num, date: a.date, company: a.company, role: a.role,
    score: a.score, status: a.status,
    pdf_present: a.pdfPresent ? 1 : 0,
    report_num: a.reportNum, notes: a.notes,
    source_line: a.sourceLine, updated_at: a.updatedAt,
  });
}

export function deleteApplication(num: number): void {
  getDbInternal().prepare("DELETE FROM applications WHERE num=?").run(num);
}

export function listApplications(f: AppFilter): Application[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (f.status) { where.push("status = @status"); params.status = f.status; }
  if (f.q) { where.push("(company LIKE @q OR role LIKE @q OR notes LIKE @q)"); params.q = `%${f.q}%`; }

  const sql = `
    SELECT * FROM applications
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY date DESC, num DESC
    LIMIT @limit OFFSET @offset
  `;
  const rows = getDbInternal().prepare(sql).all({
    ...params, limit: f.limit ?? 1000, offset: f.offset ?? 0,
  }) as any[];
  return rows.map(rowToApp);
}

function rowToApp(r: any): Application {
  return {
    num: r.num, date: r.date, company: r.company, role: r.role,
    score: r.score, status: r.status,
    pdfPresent: r.pdf_present === 1,
    reportNum: r.report_num, notes: r.notes ?? "",
    sourceLine: r.source_line, updatedAt: r.updated_at,
  };
}

const UPSERT_REPORT = `
  INSERT INTO reports(num,path,url,legitimacy,scores_json,body_md,updated_at)
  VALUES (@num,@path,@url,@legitimacy,@scores_json,@body_md,@updated_at)
  ON CONFLICT(num) DO UPDATE SET
    path=excluded.path, url=excluded.url, legitimacy=excluded.legitimacy,
    scores_json=excluded.scores_json, body_md=excluded.body_md, updated_at=excluded.updated_at
`;

export function upsertReport(r: Report): void {
  getDbInternal().prepare(UPSERT_REPORT).run({
    num: r.num, path: r.path, url: r.url, legitimacy: r.legitimacy,
    scores_json: JSON.stringify(r.scores),
    body_md: r.bodyMd, updated_at: r.updatedAt,
  });
}

export function getReport(num: number): Report | null {
  const row = getDbInternal().prepare("SELECT * FROM reports WHERE num=?").get(num) as any;
  if (!row) return null;
  return {
    num: row.num, path: row.path, url: row.url, legitimacy: row.legitimacy,
    scores: JSON.parse(row.scores_json),
    bodyMd: row.body_md, updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- sqlite
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/data/sqlite.ts web/tests/lib/sqlite.test.ts
git commit -m "feat(web): SQLite schema and CRUD for applications and reports"
```

---

## Task 6: Indexer (full + incremental)

**Files:**
- Create: `web/lib/data/indexer.ts`, `web/tests/lib/indexer.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/lib/indexer.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, listApplications, getReport } from "../../lib/data/sqlite.js";

let tmp: string;

function seed(root: string) {
  fs.mkdirSync(path.join(root, "data"), { recursive: true });
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "data/applications.md"),
    "# Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 41 | 2026-04-23 | Anthropic | Head AI | 4.8/5 | Interview | ✅ | [041](reports/041-anthropic-2026-04-23.md) | ok |\n"
  );
  fs.writeFileSync(
    path.join(root, "reports/041-anthropic-2026-04-23.md"),
    "# Anthropic\n\n**URL:** https://x\n**Legitimacy:** Verified\n\n## Block A — scope (4.8)\nbody\n"
  );
}

describe("indexer", () => {
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "co-idx-"));
    process.env.CAREER_OPS_ROOT = tmp;
    seed(tmp);
    openDb(":memory:");
  });

  it("fullIndex populates applications and reports", async () => {
    const ind = await import("../../lib/data/indexer.js?fresh1");
    const result = ind.fullIndex();
    expect(result.errors).toEqual([]);
    expect(listApplications({})).toHaveLength(1);
    expect(getReport(41)?.url).toBe("https://x");
  });

  it("indexApplicationsFile is idempotent", async () => {
    const ind = await import("../../lib/data/indexer.js?fresh2");
    ind.fullIndex();
    ind.indexApplicationsFile();
    expect(listApplications({})).toHaveLength(1);
  });

  it("indexReportFile updates a row when content changes", async () => {
    const ind = await import("../../lib/data/indexer.js?fresh3");
    ind.fullIndex();
    const reportPath = path.join(tmp, "reports/041-anthropic-2026-04-23.md");
    fs.writeFileSync(reportPath, "# A\n\n**URL:** https://y\n**Legitimacy:** Stale\n");
    ind.indexReportFile(reportPath);
    expect(getReport(41)?.url).toBe("https://y");
    expect(getReport(41)?.legitimacy).toBe("Stale");
  });

  it("removes applications no longer in the file", async () => {
    const ind = await import("../../lib/data/indexer.js?fresh4");
    ind.fullIndex();
    fs.writeFileSync(path.join(tmp, "data/applications.md"),
      "# Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n");
    ind.indexApplicationsFile();
    expect(listApplications({})).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- indexer
```

Expected: FAIL.

- [ ] **Step 3: Implement `web/lib/data/indexer.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { APPLICATIONS_FILE, REPORTS_DIR } from "../paths.js";
import { parseApplications, parseReport } from "./markdown.js";
import {
  upsertApplication, deleteApplication, upsertReport,
  openDb, listApplications,
} from "./sqlite.js";

export interface IndexResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

let initialized = false;
function ensureDb() {
  if (!initialized) { openDb(); initialized = true; }
}

export function indexApplicationsFile(filePath: string = APPLICATIONS_FILE): IndexResult {
  ensureDb();
  const result: IndexResult = { added: 0, updated: 0, removed: 0, errors: [] };
  if (!fs.existsSync(filePath)) {
    result.errors.push(`Missing ${filePath}`);
    return result;
  }
  const parsed = parseApplications(filePath);
  const parsedNums = new Set(parsed.map(p => p.num));

  const existingNums = listApplications({}).map(a => a.num);
  for (const a of parsed) upsertApplication(a);
  for (const num of existingNums) {
    if (!parsedNums.has(num)) { deleteApplication(num); result.removed++; }
  }
  result.updated = parsed.length;
  return result;
}

export function indexReportFile(filePath: string): IndexResult {
  ensureDb();
  const result: IndexResult = { added: 0, updated: 0, removed: 0, errors: [] };
  try {
    const r = parseReport(filePath);
    upsertReport(r);
    result.updated = 1;
  } catch (e) {
    result.errors.push(`${filePath}: ${(e as Error).message}`);
  }
  return result;
}

export function fullIndex(): IndexResult {
  ensureDb();
  const merged: IndexResult = { added: 0, updated: 0, removed: 0, errors: [] };
  merge(merged, indexApplicationsFile());

  if (fs.existsSync(REPORTS_DIR)) {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => /^\d{3}-.*\.md$/.test(f))
      .map(f => path.join(REPORTS_DIR, f));
    for (const f of files) merge(merged, indexReportFile(f));
  }
  return merged;
}

function merge(into: IndexResult, from: IndexResult) {
  into.added   += from.added;
  into.updated += from.updated;
  into.removed += from.removed;
  into.errors.push(...from.errors);
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- indexer
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/data/indexer.ts web/tests/lib/indexer.test.ts
git commit -m "feat(web): full and incremental indexer"
```

---

## Task 7: File watcher

**Files:**
- Create: `web/lib/data/watcher.ts`, `web/tests/lib/watcher.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/lib/watcher.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, listApplications } from "../../lib/data/sqlite.js";

let tmp: string;
let stop: (() => void) | null = null;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "co-watch-"));
  process.env.CAREER_OPS_ROOT = tmp;
  fs.mkdirSync(path.join(tmp, "data"));
  fs.mkdirSync(path.join(tmp, "reports"));
  fs.writeFileSync(path.join(tmp, "data/applications.md"),
    "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n");
  openDb(":memory:");
});
afterEach(() => { stop?.(); });

describe("watcher", () => {
  it("indexes new application rows after file change", async () => {
    const { startWatcher } = await import("../../lib/data/watcher.js?w1");
    stop = startWatcher();
    await new Promise(r => setTimeout(r, 200));

    fs.writeFileSync(path.join(tmp, "data/applications.md"),
      "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 1 | 2026-01-01 | A | R | 4/5 | Applied | ✅ | [001](reports/001.md) | x |\n");

    await new Promise(r => setTimeout(r, 800));
    expect(listApplications({}).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- watcher
```

Expected: FAIL.

- [ ] **Step 3: Implement `web/lib/data/watcher.ts`**

```ts
import chokidar from "chokidar";
import { APPLICATIONS_FILE, REPORTS_DIR } from "../paths.js";
import { indexApplicationsFile, indexReportFile } from "./indexer.js";

let watcher: chokidar.FSWatcher | null = null;
const debounce = new Map<string, NodeJS.Timeout>();

function debounced(key: string, fn: () => void) {
  const t = debounce.get(key); if (t) clearTimeout(t);
  debounce.set(key, setTimeout(() => { debounce.delete(key); fn(); }, 150));
}

export function startWatcher(): () => void {
  if (watcher) return () => stopWatcher();
  watcher = chokidar.watch([APPLICATIONS_FILE, REPORTS_DIR], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on("add",    p => routeChange(p));
  watcher.on("change", p => routeChange(p));
  watcher.on("unlink", p => routeChange(p));
  return () => stopWatcher();
}

function routeChange(p: string) {
  if (p === APPLICATIONS_FILE) {
    debounced("apps", () => indexApplicationsFile());
  } else if (p.startsWith(REPORTS_DIR)) {
    debounced(`r:${p}`, () => indexReportFile(p));
  }
}

export function stopWatcher() {
  watcher?.close(); watcher = null;
  for (const t of debounce.values()) clearTimeout(t);
  debounce.clear();
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- watcher
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/data/watcher.ts web/tests/lib/watcher.test.ts
git commit -m "feat(web): file watcher with debounced re-indexing"
```

---

## Task 8: Agent progress parser

**Files:**
- Create: `web/lib/agent/progress.ts`, `web/tests/lib/progress.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/lib/progress.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseClaudeLine } from "../../lib/agent/progress.js";

describe("parseClaudeLine", () => {
  it("recognizes 'Block N/M: label'", () => {
    expect(parseClaudeLine("Block 4/6: level strategy")).toEqual({
      type: "progress", block: 4, total: 6, label: "level strategy",
    });
  });

  it("recognizes 'Writing report 042-...'", () => {
    expect(parseClaudeLine("Writing report 042-acme-2026-04-21.md")).toEqual({
      type: "report-written", num: 42, path: "042-acme-2026-04-21.md",
    });
  });

  it("recognizes tracker update", () => {
    expect(parseClaudeLine("Tracker updated: applications.md")?.type).toBe("tracker-updated");
  });

  it("returns null for unknown lines", () => {
    expect(parseClaudeLine("hello world")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- progress
```

Expected: FAIL.

- [ ] **Step 3: Implement `web/lib/agent/progress.ts`**

```ts
import type { EvalEvent } from "../types.js";

const BLOCK_RE  = /Block\s+(\d+)\s*\/\s*(\d+)\s*[:·-]\s*(.+)$/;
const REPORT_RE = /Writing report\s+(\d{3})-(.+\.md)/i;
const TRACK_RE  = /Tracker updated/i;

export function parseClaudeLine(line: string): EvalEvent | null {
  const b = line.match(BLOCK_RE);
  if (b) return {
    type: "progress",
    block: parseInt(b[1], 10),
    total: parseInt(b[2], 10),
    label: b[3].trim(),
  };

  const r = line.match(REPORT_RE);
  if (r) return {
    type: "report-written",
    num: parseInt(r[1], 10),
    path: `${r[1]}-${r[2]}`,
  };

  if (TRACK_RE.test(line)) return { type: "tracker-updated" };
  return null;
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- progress
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/agent/progress.ts web/tests/lib/progress.test.ts
git commit -m "feat(web): claude stdout progress line parser"
```

---

## Task 9: Agent runner (subprocess + event stream)

> **Security note:** This module spawns the local `claude` binary using Node's `spawn` (NOT `exec`) with arguments passed as an array — so the user-supplied URL never touches a shell. Treat any change here that switches to `exec` or string-interpolated commands as a security regression.

**Files:**
- Create: `web/lib/agent/runner.ts`, `web/tests/lib/runner.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/lib/runner.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import type { EvalEvent } from "../../lib/types.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

import { spawn } from "node:child_process";
import { runEvaluation } from "../../lib/agent/runner.js";

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

beforeEach(() => { vi.clearAllMocks(); });

describe("runEvaluation", () => {
  it("emits started, progress events, then done on exit 0", async () => {
    const fake = new FakeProc();
    (spawn as any).mockReturnValue(fake);

    const { events, runId } = runEvaluation("https://example.com");
    expect(runId).toMatch(/[0-9a-f-]{36}/);

    const collected: EvalEvent[] = [];
    const consumer = (async () => { for await (const e of events) collected.push(e); })();

    setTimeout(() => {
      fake.stdout.emit("data", Buffer.from("Block 1/6: role summary\n"));
      fake.stdout.emit("data", Buffer.from("Block 2/6: cv match\n"));
      fake.emit("exit", 0);
    }, 10);

    await consumer;
    expect(collected[0]).toEqual({ type: "started", runId });
    expect(collected.some(e => e.type === "progress" && e.block === 1)).toBe(true);
    expect(collected.some(e => e.type === "progress" && e.block === 2)).toBe(true);
    expect(collected[collected.length - 1].type).toBe("done");
  });

  it("emits error event with stderr tail on non-zero exit", async () => {
    const fake = new FakeProc();
    (spawn as any).mockReturnValue(fake);
    const { events } = runEvaluation("https://example.com");

    const collected: EvalEvent[] = [];
    const consumer = (async () => { for await (const e of events) collected.push(e); })();

    setTimeout(() => {
      fake.stderr.emit("data", Buffer.from("auth failed\n"));
      fake.emit("exit", 1);
    }, 10);

    await consumer;
    expect(collected.find(e => e.type === "error")).toBeTruthy();
  });

  it("calls spawn with arguments as an array (no shell injection)", () => {
    const fake = new FakeProc();
    (spawn as any).mockReturnValue(fake);
    runEvaluation("https://x.com/job?id=1&q=2");
    const call = (spawn as any).mock.calls[0];
    expect(call[0]).toBe("claude");
    expect(Array.isArray(call[1])).toBe(true);
    // The slash command + URL travel as a single prompt string in argv[1].
    // No shell interpolation: spawn with array args bypasses the shell entirely.
    expect(call[1][0]).toBe("-p");
    expect(call[1][1]).toBe("/career-ops https://x.com/job?id=1&q=2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- runner
```

Expected: FAIL.

- [ ] **Step 3: Implement `web/lib/agent/runner.ts`**

```ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { CAREER_OPS_ROOT, EVAL_RUNS_DIR } from "../paths.js";
import { parseClaudeLine } from "./progress.js";
import type { EvalEvent } from "../types.js";

export function runEvaluation(url: string): {
  events: AsyncIterable<EvalEvent>;
  runId: string;
} {
  const runId = uuid();
  fs.mkdirSync(EVAL_RUNS_DIR, { recursive: true });
  const logPath = path.join(EVAL_RUNS_DIR, `${runId}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  // CRITICAL: pass args as an array. spawn with an array of args does NOT
  // invoke a shell, so the URL inside the prompt string cannot trigger any
  // shell interpolation. Never switch this to a string-interpolated command.
  const proc = spawn("claude", ["-p", `/career-ops ${url}`], {
    cwd: CAREER_OPS_ROOT,
    env: process.env,
  });

  const stderrTail: string[] = [];
  const queue: EvalEvent[] = [{ type: "started", runId }];
  let resolveNext: ((v: EvalEvent | null) => void) | null = null;
  let finished = false;

  const push = (e: EvalEvent) => {
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(e); }
    else queue.push(e);
  };

  const handleLine = (line: string) => {
    logStream.write(line + "\n");
    push({ type: "log", line });
    const ev = parseClaudeLine(line);
    if (ev) push(ev);
  };

  let buf = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      handleLine(line);
    }
  });
  proc.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    logStream.write(`[stderr] ${text}`);
    for (const line of text.split("\n")) {
      if (line) { stderrTail.push(line); if (stderrTail.length > 20) stderrTail.shift(); }
    }
  });
  proc.on("error", (e) => {
    push({ type: "error", message: e.message, tail: stderrTail });
    finished = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
  });
  proc.on("exit", (code) => {
    if (buf.length) handleLine(buf); buf = "";
    if (code === 0) push({ type: "done", runId });
    else push({ type: "error", message: `claude exited ${code}`, tail: stderrTail });
    finished = true;
    logStream.end();
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
  });

  const events: AsyncIterable<EvalEvent> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<EvalEvent>> {
          if (queue.length) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (finished) return Promise.resolve({ value: undefined as any, done: true });
          return new Promise((resolve) => {
            resolveNext = (e) => {
              if (e === null) resolve({ value: undefined as any, done: true });
              else resolve({ value: e, done: false });
            };
          });
        },
      };
    },
  };

  return { events, runId };
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- runner
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/agent/runner.ts web/tests/lib/runner.test.ts
git commit -m "feat(web): subprocess-based agent runner with event stream"
```

---

## Task 10: API route — list applications

**Files:**
- Create: `web/app/api/applications/route.ts`, `web/tests/api/applications.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/api/applications.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { openDb } from "../../lib/data/sqlite.js";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "co-api-"));
  process.env.CAREER_OPS_ROOT = tmp;
  fs.mkdirSync(path.join(tmp, "data"));
  fs.mkdirSync(path.join(tmp, "reports"));
  fs.writeFileSync(path.join(tmp, "data/applications.md"),
    "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n| 1 | 2026-04-01 | Acme | Eng | 4.0/5 | Applied | ✅ | [001](reports/001.md) | x |\n");
  openDb(":memory:");
});

describe("GET /api/applications", () => {
  it("returns list with seeded row after fullIndex", async () => {
    const ind = await import("../../lib/data/indexer.js?api1");
    ind.fullIndex();
    const route = await import("../../app/api/applications/route.js?api1");
    const res = await route.GET(new Request("http://localhost/api/applications"));
    const body = await res.json();
    expect(body.applications).toHaveLength(1);
    expect(body.applications[0].company).toBe("Acme");
  });

  it("respects status filter via query string", async () => {
    const ind = await import("../../lib/data/indexer.js?api2");
    ind.fullIndex();
    const route = await import("../../app/api/applications/route.js?api2");
    const res = await route.GET(new Request("http://localhost/api/applications?status=Offer"));
    const body = await res.json();
    expect(body.applications).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- api/applications
```

Expected: FAIL.

- [ ] **Step 3: Implement the route**

`web/app/api/applications/route.ts`:
```ts
import { NextResponse } from "next/server";
import { listApplications } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

let warmed = false;
function warm() { if (!warmed) { fullIndex(); warmed = true; } }

export async function GET(req: Request) {
  warm();
  const url = new URL(req.url);
  const apps = listApplications({
    status: url.searchParams.get("status") ?? undefined,
    q:      url.searchParams.get("q") ?? undefined,
    limit:  url.searchParams.has("limit")  ? parseInt(url.searchParams.get("limit")!,  10) : undefined,
    offset: url.searchParams.has("offset") ? parseInt(url.searchParams.get("offset")!, 10) : undefined,
  });
  return NextResponse.json({ applications: apps });
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- api/applications
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/applications/route.ts web/tests/api/applications.test.ts
git commit -m "feat(web): GET /api/applications"
```

---

## Task 11: API route — get report

**Files:**
- Create: `web/app/api/reports/[num]/route.ts`, `web/tests/api/reports.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/api/reports.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { openDb } from "../../lib/data/sqlite.js";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "co-rep-"));
  process.env.CAREER_OPS_ROOT = tmp;
  fs.mkdirSync(path.join(tmp, "data")); fs.mkdirSync(path.join(tmp, "reports"));
  fs.writeFileSync(path.join(tmp, "data/applications.md"),
    "| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n");
  fs.writeFileSync(path.join(tmp, "reports/041-acme-2026-04-23.md"),
    "# Acme\n\n**URL:** https://x\n**Legitimacy:** Verified\n\n## Block A — scope (4.5)\nbody\n");
  openDb(":memory:");
});

describe("GET /api/reports/:num", () => {
  it("returns the report when present", async () => {
    const ind = await import("../../lib/data/indexer.js?rep1");
    ind.fullIndex();
    const route = await import("../../app/api/reports/[num]/route.js?rep1");
    const res = await route.GET(new Request("http://localhost/api/reports/41"),
      { params: Promise.resolve({ num: "41" }) });
    const body = await res.json();
    expect(body.report.url).toBe("https://x");
  });

  it("returns 404 when not present", async () => {
    const route = await import("../../app/api/reports/[num]/route.js?rep2");
    const res = await route.GET(new Request("http://localhost/api/reports/999"),
      { params: Promise.resolve({ num: "999" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- api/reports
```

Expected: FAIL.

- [ ] **Step 3: Implement the route**

`web/app/api/reports/[num]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getReport } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

let warmed = false;
function warm() { if (!warmed) { fullIndex(); warmed = true; } }

export async function GET(_req: Request, { params }: { params: Promise<{ num: string }> }) {
  warm();
  const { num } = await params;
  const r = getReport(parseInt(num, 10));
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ report: r });
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- api/reports
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "web/app/api/reports/[num]/route.ts" web/tests/api/reports.test.ts
git commit -m "feat(web): GET /api/reports/:num"
```

---

## Task 12: API route — reindex

**Files:**
- Create: `web/app/api/reindex/route.ts`

- [ ] **Step 1: Implement**

`web/app/api/reindex/route.ts`:
```ts
import { NextResponse } from "next/server";
import { fullIndex } from "@/lib/data/indexer";

export async function POST() {
  const result = fullIndex();
  return NextResponse.json({ result });
}
```

- [ ] **Step 2: Smoke test manually**

```bash
npm run dev
curl -X POST http://localhost:3000/api/reindex
```

Expected: JSON `{ result: { added, updated, removed, errors: [] } }`.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/reindex/route.ts
git commit -m "feat(web): POST /api/reindex"
```

---

## Task 13: API route — evaluate (SSE)

**Files:**
- Create: `web/app/api/evaluate/route.ts`, `web/tests/api/evaluate.test.ts`

- [ ] **Step 1: Write the failing test**

`web/tests/api/evaluate.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/agent/runner.js", () => ({
  runEvaluation: () => ({
    runId: "run-123",
    events: (async function* () {
      yield { type: "started", runId: "run-123" };
      yield { type: "progress", block: 1, total: 6, label: "role" };
      yield { type: "done", runId: "run-123" };
    })(),
  }),
}));

beforeEach(() => { vi.resetModules(); });

describe("POST /api/evaluate", () => {
  it("streams SSE events terminated by data: [DONE]", async () => {
    const route = await import("../../app/api/evaluate/route.js?ev1");
    const res = await route.POST(new Request("http://localhost/api/evaluate", {
      method: "POST",
      body: JSON.stringify({ url: "https://x.com" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"type":"started"');
    expect(text).toContain('"type":"progress"');
    expect(text).toContain('"type":"done"');
    expect(text.trim().endsWith("data: [DONE]")).toBe(true);
  });

  it("rejects requests missing url", async () => {
    const route = await import("../../app/api/evaluate/route.js?ev2");
    const res = await route.POST(new Request("http://localhost/api/evaluate", {
      method: "POST", body: "{}",
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- api/evaluate
```

Expected: FAIL.

- [ ] **Step 3: Implement the route**

`web/app/api/evaluate/route.ts`:
```ts
import { runEvaluation } from "@/lib/agent/runner";

export async function POST(req: Request) {
  const { url } = await req.json() as { url?: string };
  if (!url) return new Response("missing url", { status: 400 });

  const { events } = runEvaluation(url);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const ev of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
          if (ev.type === "done" || ev.type === "error") break;
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
```

- [ ] **Step 4: Verify**

```bash
npm test -- api/evaluate
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/evaluate/route.ts web/tests/api/evaluate.test.ts
git commit -m "feat(web): POST /api/evaluate streams SSE events"
```

---

## Task 14: App shell — fonts, tokens, base layout

**Files:**
- Modify: `web/app/globals.css`, `web/app/layout.tsx`

- [ ] **Step 1: Replace `web/app/globals.css` with the full token system**

```css
@import "tailwindcss";

:root {
  --hue: 60;
  --bg:           oklch(0.165 0.012 var(--hue));
  --bg-deep:      oklch(0.135 0.010 var(--hue));
  --surface:      oklch(0.215 0.014 var(--hue));
  --surface-2:    oklch(0.255 0.016 var(--hue));
  --surface-hi:   oklch(0.305 0.018 var(--hue));
  --line:         oklch(0.305 0.014 var(--hue));
  --line-soft:    oklch(0.245 0.012 var(--hue));
  --ink:          oklch(0.955 0.008 80);
  --ink-2:        oklch(0.760 0.012 70);
  --ink-3:        oklch(0.560 0.010 65);
  --ink-4:        oklch(0.420 0.010 65);
  --ember:        oklch(0.745 0.180 55);
  --ember-deep:   oklch(0.620 0.190 50);
  --ember-soft:   oklch(0.745 0.180 55 / 0.14);
  --sage:         oklch(0.795 0.110 145);
  --amber:        oklch(0.820 0.140 85);
  --oxblood:      oklch(0.620 0.150 25);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
::selection { background: var(--ember-soft); color: var(--ink); }
```

- [ ] **Step 2: Wire fonts via `next/font/google` in `web/app/layout.tsx`**

```tsx
import "./globals.css";
import { Albert_Sans, Bricolage_Grotesque } from "next/font/google";

const body    = Albert_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata = { title: "career-ops" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

(Departure Mono is not on Google Fonts; v1 falls back to system monospace tokens. Self-host later via `next/font/local` and a downloaded `.woff2` if desired.)

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Open http://localhost:3000 — page renders with the warm dark token applied.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/layout.tsx
git commit -m "feat(web): app shell with mockup tokens and fonts"
```

---

## Task 15: Component primitives — ScoreBar, StatusPill

**Files:**
- Create: `web/components/ScoreBar.tsx`, `web/components/StatusPill.tsx`, `web/tests/components/score-bar.test.tsx`
- Modify: `web/vitest.config.ts`, `web/package.json`

- [ ] **Step 1: Add jsdom env for component tests**

Replace `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    globals: false,
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
});
```

Install:
```bash
cd web && npm i -D jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Write the failing test**

`web/tests/components/score-bar.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScoreBar } from "../../components/ScoreBar.js";

describe("ScoreBar", () => {
  it("renders 5 segments", () => {
    const { container } = render(<ScoreBar score={4.2} />);
    expect(container.querySelectorAll("[data-seg]")).toHaveLength(5);
  });
  it("fills floor(score) segments fully", () => {
    const { container } = render(<ScoreBar score={4.2} />);
    expect(container.querySelectorAll('[data-fill="full"]').length).toBe(4);
  });
  it("accepts null score with no fills", () => {
    const { container } = render(<ScoreBar score={null} />);
    expect(container.querySelectorAll('[data-fill="full"]').length).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- score-bar
```

Expected: FAIL.

- [ ] **Step 4: Implement**

`web/components/ScoreBar.tsx`:
```tsx
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
```

`web/components/StatusPill.tsx`:
```tsx
import type { CanonicalStatus } from "@/lib/types";

const VARIANT: Record<string, string> = {
  Evaluated: "s-eval",
  Applied: "s-applied",
  Interview: "s-interview",
  Offer: "s-offer",
  Rejected: "s-rejected",
  Discarded: "s-skip",
  SKIP: "s-skip",
  Responded: "s-applied",
};

export function StatusPill({ status }: { status: CanonicalStatus | string }) {
  const v = VARIANT[status] ?? "s-eval";
  return <span className={`status ${v}`}>{status}</span>;
}
```

Append the `.score`, `.score-bar`, `.status`, and `.status.s-*` rules from `mockups/pipeline.html` into `web/app/globals.css`. This is a mechanical port — copy the rules verbatim.

- [ ] **Step 5: Verify**

```bash
npm test -- score-bar
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/components/ScoreBar.tsx web/components/StatusPill.tsx \
        web/tests/components/score-bar.test.tsx web/app/globals.css \
        web/vitest.config.ts web/package.json web/package-lock.json
git commit -m "feat(web): ScoreBar and StatusPill primitives"
```

---

## Task 16: Static chrome — NavRail, Topbar, CommandBar

**Files:**
- Create: `web/components/NavRail.tsx`, `web/components/Topbar.tsx`, `web/components/CommandBar.tsx`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Port chrome CSS into `globals.css`**

Append the `.app`, `.topbar`, `.brand`, `.brand-mark`, `.pulse`, `nav.rail`, `.rail-link`, `.cmd`, `.cmd .k`, `.cmd .grp`, `.cmd .right`, `.cmd .ok` blocks from `mockups/pipeline.html` into `web/app/globals.css`. (The mockup uses `nav.rail a` selectors; rename to `.rail-link` to match the React component. Mechanical search/replace.)

- [ ] **Step 2: Implement Topbar**

`web/components/Topbar.tsx`:
```tsx
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
```

- [ ] **Step 3: Implement NavRail**

`web/components/NavRail.tsx`:
```tsx
import Link from "next/link";

export function NavRail({ active, counts }: {
  active: "pipeline" | "evaluate" | "reports";
  counts: { pipeline: number };
}) {
  const item = (key: string, label: string, href: string, badge?: string) => (
    <Link href={href} className={`rail-link ${active === key ? "is-active" : ""}`} key={key}>
      <span>{label}</span>
      {badge && <span className="badge">{badge}</span>}
    </Link>
  );
  return (
    <nav className="rail">
      <div className="group"><h6>Workspace</h6></div>
      {item("pipeline", "Pipeline",     "/", String(counts.pipeline))}
      {item("evaluate", "Evaluate URL", "/evaluate")}
      {item("reports",  "Reports",      "/reports")}
    </nav>
  );
}
```

- [ ] **Step 4: Implement CommandBar**

`web/components/CommandBar.tsx`:
```tsx
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
```

- [ ] **Step 5: Commit**

```bash
git add web/components/Topbar.tsx web/components/NavRail.tsx \
        web/components/CommandBar.tsx web/app/globals.css
git commit -m "feat(web): static topbar, nav rail, command bar"
```

---

## Task 17: Dashboard layout

**Files:**
- Create: `web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Implement**

`web/app/(dashboard)/layout.tsx`:
```tsx
import { Topbar } from "@/components/Topbar";
import { NavRail } from "@/components/NavRail";
import { CommandBar } from "@/components/CommandBar";
import { listApplications } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  fullIndex();
  const apps = listApplications({});
  const evaluated = apps.length;
  const offers    = apps.filter(a => a.status === "Offer").length;
  const scored    = apps.filter(a => typeof a.score === "number") as Array<{ score: number }>;
  const avgScore  = scored.length ? scored.reduce((s, a) => s + a.score, 0) / scored.length : 0;

  return (
    <div className="app">
      <Topbar
        session={`SF-${Date.now().toString().slice(-5)}`}
        evaluated={evaluated} offers={offers} avgScore={avgScore}
      />
      <NavRail active="pipeline" counts={{ pipeline: apps.length }} />
      <main>{children}</main>
      <CommandBar />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "web/app/(dashboard)/layout.tsx"
git commit -m "feat(web): dashboard layout composes shell components"
```

---

## Task 18: PipelineTable component

**Files:**
- Create: `web/components/PipelineTable.tsx`, `web/tests/components/pipeline-table.test.tsx`

- [ ] **Step 1: Write the failing test**

`web/tests/components/pipeline-table.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineTable } from "../../components/PipelineTable.js";

const apps = [{
  num: 41, date: "2026-04-23", company: "Anthropic", role: "Head AI",
  score: 4.8, status: "Interview", pdfPresent: true, reportNum: 41,
  notes: "", sourceLine: 5, updatedAt: 0,
}];

describe("PipelineTable", () => {
  it("renders one row per application", () => {
    render(<PipelineTable applications={apps} selectedNum={null} onSelect={() => {}} />);
    expect(screen.getByText("Anthropic")).toBeTruthy();
    expect(screen.getByText("Head AI")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- pipeline-table
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`web/components/PipelineTable.tsx`:
```tsx
"use client";
import type { Application } from "@/lib/types";
import { ScoreBar } from "./ScoreBar";
import { StatusPill } from "./StatusPill";

export function PipelineTable({
  applications, selectedNum, onSelect,
}: {
  applications: Application[];
  selectedNum: number | null;
  onSelect: (num: number) => void;
}) {
  return (
    <table className="apps">
      <thead>
        <tr>
          <th style={{ width: 46 }}>#</th>
          <th>Company</th>
          <th>Role</th>
          <th style={{ width: 120 }}>Score</th>
          <th style={{ width: 130 }}>Status</th>
          <th style={{ width: 90 }}>Date</th>
        </tr>
      </thead>
      <tbody>
        {applications.map(a => (
          <tr key={a.num}
              className={selectedNum === a.num ? "is-selected" : ""}
              onClick={() => onSelect(a.num)}>
            <td className="id">{String(a.num).padStart(3, "0")}</td>
            <td>
              <div className="co">
                <div className="logo">{a.company[0]}</div>
                <div className="co-name"><b>{a.company}</b></div>
              </div>
            </td>
            <td><div className="role">{a.role}</div></td>
            <td><ScoreBar score={a.score} /></td>
            <td><StatusPill status={a.status} /></td>
            <td className="date">{a.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Append the `table.apps`, `.id`, `.co`, `.logo`, `.co-name`, `.role`, `.date` blocks from `mockups/pipeline.html` to `web/app/globals.css`.

- [ ] **Step 4: Verify**

```bash
npm test -- pipeline-table
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/components/PipelineTable.tsx web/tests/components/pipeline-table.test.tsx web/app/globals.css
git commit -m "feat(web): PipelineTable renders applications"
```

---

## Task 19: MetricsRow + Toolbar

**Files:**
- Create: `web/components/MetricsRow.tsx`, `web/components/Toolbar.tsx`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Implement**

`web/components/MetricsRow.tsx`:
```tsx
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
```

`web/components/Toolbar.tsx`:
```tsx
"use client";
import { useState } from "react";

export function Toolbar({ onFilter, onSearch }: {
  onFilter: (status: string | undefined) => void;
  onSearch: (q: string) => void;
}) {
  const [active, setActive] = useState<string>("All");
  const tabs = ["All", "Evaluated", "Applied", "Interview", "Offer"];
  return (
    <div className="toolbar">
      <div className="seg">
        {tabs.map(t => (
          <button key={t}
            className={active === t ? "is-on" : ""}
            onClick={() => { setActive(t); onFilter(t === "All" ? undefined : t); }}>
            {t}
          </button>
        ))}
      </div>
      <div className="search">
        <input placeholder="Filter by company, role, location…"
               onChange={e => onSearch(e.target.value)} />
      </div>
    </div>
  );
}
```

Append `.metrics`, `.metric`, `.toolbar`, `.seg`, `.search` blocks from the mockup into `web/app/globals.css`.

- [ ] **Step 2: Commit**

```bash
git add web/components/MetricsRow.tsx web/components/Toolbar.tsx web/app/globals.css
git commit -m "feat(web): MetricsRow and Toolbar"
```

---

## Task 20: DetailPanel component

**Files:**
- Create: `web/components/DetailPanel.tsx`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Implement**

`web/components/DetailPanel.tsx`:
```tsx
import type { Application, Report } from "@/lib/types";
import Link from "next/link";

export function DetailPanel({ app, report }: { app: Application | null; report: Report | null }) {
  if (!app) {
    return <aside className="detail"><div className="dh"><p>Select a row to see the report.</p></div></aside>;
  }
  return (
    <aside className="detail">
      <div className="dh">
        <div className="id-line">Report · #{String(app.num).padStart(3, "0")} · {app.date}</div>
        <h3>{app.role}</h3>
        <div className="at">at <b>{app.company}</b></div>
        {app.score !== null && (
          <div className="verdict">
            <div className="num">{app.score.toFixed(1)}<small>/ 5.0</small></div>
            <div className="verdict-body">
              <div className="rec">{app.score >= 4 ? "Recommend" : "Below threshold"}</div>
              <p>{app.notes || "No notes."}</p>
            </div>
          </div>
        )}
      </div>
      {report && (
        <div className="section">
          <h4>Score breakdown</h4>
          <div className="breakdown">
            {(["A","B","C","D","E","F","G"] as const).map(k => report.scores[k] !== undefined && (
              <div key={k} className="row">
                <div className="label">{k}</div>
                <div className="meter"><span style={{ width: `${(report.scores[k]! / 5) * 100}%` }} /></div>
                <div className="v">{report.scores[k]!.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="actions">
        <Link href={`/reports/${app.num}`} className="btn">Open report</Link>
      </div>
    </aside>
  );
}
```

Append `.detail`, `.verdict`, `.row`, `.actions` blocks from the mockup.

- [ ] **Step 2: Commit**

```bash
git add web/components/DetailPanel.tsx web/app/globals.css
git commit -m "feat(web): DetailPanel renders selected application"
```

---

## Task 21: Pipeline page (the home route)

**Files:**
- Create: `web/app/(dashboard)/page.tsx`, `web/components/PipelineView.tsx`

- [ ] **Step 1: Implement the server page**

`web/app/(dashboard)/page.tsx`:
```tsx
import { listApplications } from "@/lib/data/sqlite";
import { PipelineView } from "@/components/PipelineView";

export default async function PipelinePage() {
  const apps = listApplications({});
  return <PipelineView initialApplications={apps} />;
}
```

- [ ] **Step 2: Implement the client view**

`web/components/PipelineView.tsx`:
```tsx
"use client";
import { useMemo, useState } from "react";
import type { Application, Report } from "@/lib/types";
import { PipelineTable } from "./PipelineTable";
import { Toolbar } from "./Toolbar";
import { MetricsRow } from "./MetricsRow";
import { DetailPanel } from "./DetailPanel";

export function PipelineView({ initialApplications }: { initialApplications: Application[] }) {
  const [apps] = useState(initialApplications);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const [selectedNum, setSelectedNum] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const filtered = useMemo(() => apps.filter(a =>
    (!statusFilter || a.status === statusFilter) &&
    (!q || (a.company + a.role + a.notes).toLowerCase().includes(q.toLowerCase()))
  ), [apps, statusFilter, q]);

  const selected = selectedNum ? apps.find(a => a.num === selectedNum) ?? null : null;

  async function selectRow(num: number) {
    setSelectedNum(num);
    const res = await fetch(`/api/reports/${num}`);
    setReport(res.ok ? (await res.json()).report : null);
  }

  const offers = apps.filter(a => a.status === "Offer").length;
  const scoredCount = apps.filter(a => a.score !== null).length;
  const avg = scoredCount
    ? apps.reduce((s, a) => s + (a.score ?? 0), 0) / scoredCount
    : 0;

  return (
    <>
      <div className="head">
        <h1 className="title">Pipeline</h1>
        <MetricsRow pipeline={apps.length} avgScore={avg} offers={offers} responseRate={28} />
      </div>
      <Toolbar onFilter={setStatusFilter} onSearch={setQ} />
      <div className="table-wrap">
        <PipelineTable applications={filtered} selectedNum={selectedNum} onSelect={selectRow} />
      </div>
      <DetailPanel app={selected} report={report} />
    </>
  );
}
```

- [ ] **Step 3: Manual smoke**

```bash
npm run dev
```

Open http://localhost:3000 — see the dashboard with rows from `data/applications.md`.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(dashboard)/page.tsx" web/components/PipelineView.tsx
git commit -m "feat(web): pipeline page wires server data to client view"
```

---

## Task 22: EvaluateLiveStream component

**Files:**
- Create: `web/components/EvaluateLiveStream.tsx`

- [ ] **Step 1: Implement the SSE consumer**

`web/components/EvaluateLiveStream.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { EvalEvent } from "@/lib/types";
import { useRouter } from "next/navigation";

export function EvaluateLiveStream({ url }: { url: string }) {
  const [progress, setProgress] = useState<{ block: number; total: number; label: string } | null>(null);
  const [logTail, setLogTail] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; startedRef.current = true;

    (async () => {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.body) { setError("No response body"); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, nl); buf = buf.slice(nl + 2);
          if (!chunk.startsWith("data: ")) continue;
          const payload = chunk.slice(6);
          if (payload === "[DONE]") return;
          const ev: EvalEvent = JSON.parse(payload);
          if (ev.type === "progress") setProgress({ block: ev.block, total: ev.total, label: ev.label });
          if (ev.type === "log") setLogTail(t => [...t.slice(-9), ev.line]);
          if (ev.type === "error") setError(ev.message);
          if (ev.type === "report-written") router.push(`/reports/${ev.num}`);
        }
      }
    })();
  }, [url, router]);

  return (
    <div className="evaluate-live">
      <h2>Evaluating {url}</h2>
      {progress && <p>Block {progress.block} / {progress.total} · {progress.label}</p>}
      <pre className="log-tail">{logTail.join("\n")}</pre>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/EvaluateLiveStream.tsx
git commit -m "feat(web): EvaluateLiveStream consumes SSE and shows progress"
```

---

## Task 23: Evaluate page

**Files:**
- Create: `web/app/(dashboard)/evaluate/page.tsx`

- [ ] **Step 1: Implement**

`web/app/(dashboard)/evaluate/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { EvaluateLiveStream } from "@/components/EvaluateLiveStream";

export default function EvaluatePage() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  return (
    <div className="evaluate-page" style={{ padding: 24 }}>
      <h1 className="title">Evaluate a job posting</h1>
      {!running ? (
        <form onSubmit={e => { e.preventDefault(); setRunning(url); }}>
          <input type="url" required value={url}
                 placeholder="https://company.com/careers/role"
                 onChange={e => setUrl(e.target.value)}
                 style={{ width: 480 }} />
          <button className="btn primary" type="submit">Run evaluation</button>
        </form>
      ) : (
        <EvaluateLiveStream url={running} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "web/app/(dashboard)/evaluate/page.tsx"
git commit -m "feat(web): evaluate page with URL form and live stream"
```

---

## Task 24: Report viewer page

**Files:**
- Create: `web/app/(dashboard)/reports/[num]/page.tsx`
- Modify: `web/app/globals.css` (markdown styles)

- [ ] **Step 1: Implement**

`web/app/(dashboard)/reports/[num]/page.tsx`:
```tsx
import { getReport } from "@/lib/data/sqlite";
import { fullIndex } from "@/lib/data/indexer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";

export default async function ReportPage({ params }: { params: Promise<{ num: string }> }) {
  fullIndex();
  const { num } = await params;
  const report = getReport(parseInt(num, 10));
  if (!report) notFound();

  return (
    <div className="report-page" style={{ padding: 24, maxWidth: 880 }}>
      <div className="id-line">Report · #{String(report.num).padStart(3, "0")}</div>
      {report.url && <p><a href={report.url} target="_blank" rel="noreferrer">{report.url}</a></p>}
      {report.legitimacy && <p>Legitimacy: {report.legitimacy}</p>}
      <article className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.bodyMd}</ReactMarkdown>
      </article>
    </div>
  );
}
```

Append minimal markdown styling to `web/app/globals.css`:
```css
.markdown { color: var(--ink); line-height: 1.6; }
.markdown h1 { font-size: 28px; margin: 24px 0 12px; }
.markdown h2 { font-size: 20px; margin: 24px 0 8px; color: var(--ink); }
.markdown h3 { font-size: 16px; margin: 16px 0 4px; color: var(--ink-2); }
.markdown p  { margin: 0 0 12px; color: var(--ink-2); }
.markdown ul { margin: 0 0 12px; padding-left: 20px; color: var(--ink-2); }
.markdown a  { color: var(--ember); }
.markdown code { background: var(--surface); padding: 2px 6px; border-radius: 3px; }
```

- [ ] **Step 2: Commit**

```bash
git add "web/app/(dashboard)/reports/[num]/page.tsx" web/app/globals.css
git commit -m "feat(web): report viewer page renders markdown"
```

---

## Task 25: Boot-time index + watcher

**Files:**
- Create: `web/instrumentation.ts`

- [ ] **Step 1: Implement Next.js instrumentation hook**

`web/instrumentation.ts`:
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { fullIndex }    = await import("./lib/data/indexer.js");
    const { startWatcher } = await import("./lib/data/watcher.js");
    fullIndex();
    startWatcher();
  }
}
```

- [ ] **Step 2: Verify**

```bash
npm run dev
```

In another terminal, edit `data/applications.md` and add a row. Within 1 second, refresh the dashboard — the new row should appear.

- [ ] **Step 3: Commit**

```bash
git add web/instrumentation.ts
git commit -m "feat(web): boot-time fullIndex + watcher via instrumentation"
```

---

## Task 26: Playwright E2E smoke

**Files:**
- Create: `web/tests/e2e/happy-path.spec.ts`, `web/tests/e2e/fixtures/applications.md`, `web/tests/e2e/fixtures/reports/041-acme-2026-04-23.md`

- [ ] **Step 1: Write the spec**

`web/tests/e2e/happy-path.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeAll(async () => {
  process.env.CAREER_OPS_ROOT = path.resolve(__dirname, "fixtures");
});

test("pipeline → report viewer happy path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Acme")).toBeVisible();
  await page.getByText("Acme").click();
  await page.getByText("Open report").click();
  await expect(page.getByText("Block A")).toBeVisible();
});
```

`web/tests/e2e/fixtures/applications.md`:
```markdown
| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|---|---|---|---|---|---|---|---|
| 41 | 2026-04-23 | Acme | Engineer | 4.5/5 | Applied | ✅ | [041](reports/041-acme-2026-04-23.md) | E2E |
```

`web/tests/e2e/fixtures/reports/041-acme-2026-04-23.md`:
```markdown
# Acme

**URL:** https://acme.test
**Legitimacy:** Verified

## Block A — scope (4.5)
body
```

- [ ] **Step 2: Install Playwright browsers**

```bash
cd web && npx playwright install chromium
```

- [ ] **Step 3: Build and run E2E**

```bash
npm run build
CAREER_OPS_ROOT=$(pwd)/tests/e2e/fixtures npm run e2e
```

Expected: spec passes.

- [ ] **Step 4: Commit**

```bash
git add web/tests/e2e/
git commit -m "test(web): e2e happy path pipeline to report"
```

---

## Task 27: README and tunnel docs

**Files:**
- Create: `web/README.md`

- [ ] **Step 1: Write the README**

`web/README.md`:
```markdown
# career-ops · web

A personal web UX on top of the existing career-ops CLI. Runs on your
laptop; reachable from anywhere via Cloudflare Tunnel + Access.

## Run locally

\`\`\`bash
cd web
npm install
npm run build
npm start            # listens on :3000
\`\`\`

Open http://localhost:3000.

## Expose remotely (Cloudflare Tunnel + Access)

1. Install: `brew install cloudflared` (or platform equivalent)
2. Authenticate: `cloudflared tunnel login`
3. Create tunnel: `cloudflared tunnel create career-ops`
4. Route DNS: `cloudflared tunnel route dns career-ops career-ops.<yourdomain>`
5. Run the tunnel:
   \`\`\`
   cloudflared tunnel --url http://localhost:3000 run career-ops
   \`\`\`
6. In Cloudflare Zero Trust → Access → Applications, add a Self-hosted
   app for `career-ops.<yourdomain>` with a single rule: emails =
   your Google identity.

The laptop must be running `npm start` for evaluations. The pipeline
view is read-only and works whenever the tunnel and laptop are up.

## Architecture

See `../docs/superpowers/specs/2026-04-25-career-ops-web-app-design.md`.

## Tests

\`\`\`bash
npm test            # vitest unit/integration
npm run e2e         # playwright
npm run typecheck   # tsc --noEmit
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add web/README.md
git commit -m "docs(web): README with run + tunnel instructions"
```

---

## Self-review checklist (run before declaring complete)

- [ ] `cd web && npm run typecheck` — passes
- [ ] `cd web && npm test` — all unit/integration tests pass
- [ ] `cd web && npm run build` — production build succeeds
- [ ] `cd web && npm run e2e` — Playwright happy path passes
- [ ] `npm run dev`, paste a real URL on `/evaluate`, confirm progress streams and a report appears in pipeline within seconds of `claude` finishing
- [ ] Edit `data/applications.md` in another terminal; the pipeline view picks up the change on next refresh

## Spec-to-task coverage map

| Spec section | Tasks |
|---|---|
| §2 Architecture | 1, 14, 17, 27 |
| §3 Stack | 1, 14, 15 |
| §4 Project layout | 1, all subsequent |
| §5 Data model — markdown | 3, 4 |
| §5 Data model — SQLite schema | 5 |
| §5 Boot sequence | 5, 25 |
| §5 Indexer | 6 |
| §6 Components — lib/data | 3, 4, 5, 6, 7 |
| §6 Components — lib/agent | 8, 9 |
| §6 Components — API routes | 10, 11, 12, 13 |
| §7 Data flow — pipeline | 17, 18, 19, 20, 21 |
| §7 Data flow — evaluate | 13, 22, 23 |
| §7 Data flow — report viewer | 11, 24 |
| §8 Error handling | 9, 13, 24 |
| §9 Testing strategy | 3-13 (units), 26 (e2e) |
| §10 Migration | 25, 27 |


