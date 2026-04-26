import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SQLITE_FILE } from "../paths.js";
import type { Application, Report, AppFilter } from "../types.js";

const SCHEMA_VERSION = "2";
let db: Database.Database | null = null;

export function openDb(file: string = SQLITE_FILE): Database.Database {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

export function isOpen(): boolean {
  return db !== null;
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
      error_msg TEXT,
      pid INTEGER
    );
  `);

  const cur = d.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value: string } | undefined;
  if (!cur) {
    d.prepare("INSERT INTO meta(key,value) VALUES ('schema_version', ?)").run(SCHEMA_VERSION);
  } else if (cur.value === SCHEMA_VERSION) {
    // already current, no-op
  } else if (cur.value === "1") {
    // v1 -> v2: add pid column to eval_runs
    const cols = d.prepare("PRAGMA table_info(eval_runs)").all() as Array<{ name: string }>;
    if (!cols.some(c => c.name === "pid")) {
      d.exec("ALTER TABLE eval_runs ADD COLUMN pid INTEGER;");
    }
    d.prepare("UPDATE meta SET value = ? WHERE key='schema_version'").run(SCHEMA_VERSION);
  } else {
    throw new Error(`Unexpected schema version ${cur.value}`);
  }
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

/**
 * Returns a Map<url, reportNum> for fast URL→report lookup. Used by
 * /api/runs to match runs whose stdout didn't trigger the
 * "Writing report" parser, by joining on the URL the report records.
 */
export function reportNumByUrl(): Map<string, number> {
  const rows = getDbInternal().prepare("SELECT num, url FROM reports WHERE url IS NOT NULL").all() as Array<{ num: number; url: string }>;
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.url, r.num);
  return m;
}

// ── eval_runs ──────────────────────────────────────────────────────────

export type EvalRunStatus = "running" | "complete" | "failed";

export interface EvalRun {
  id: string;
  url: string;
  status: EvalRunStatus;
  startedAt: number;
  finishedAt: number | null;
  resultNum: number | null;
  logPath: string;
  errorMsg: string | null;
  pid: number | null;
}

export function insertEvalRun(r: {
  id: string; url: string; logPath: string; pid: number | null;
}): void {
  getDbInternal().prepare(`
    INSERT INTO eval_runs(id, url, status, started_at, finished_at, result_num, log_path, error_msg, pid)
    VALUES (@id, @url, 'running', @started_at, NULL, NULL, @log_path, NULL, @pid)
  `).run({
    id: r.id, url: r.url, log_path: r.logPath, pid: r.pid,
    started_at: Date.now(),
  });
}

export function updateEvalRun(id: string, patch: {
  status: EvalRunStatus;
  resultNum?: number | null;
  errorMsg?: string | null;
}): void {
  getDbInternal().prepare(`
    UPDATE eval_runs
    SET status = @status,
        finished_at = @finished_at,
        result_num = @result_num,
        error_msg = @error_msg
    WHERE id = @id
  `).run({
    id,
    status: patch.status,
    finished_at: Date.now(),
    result_num: patch.resultNum ?? null,
    error_msg: patch.errorMsg ?? null,
  });
}

export function listEvalRuns(filter: { status?: EvalRunStatus; limit?: number } = {}): EvalRun[] {
  const where = filter.status ? "WHERE status = @status" : "";
  const rows = getDbInternal().prepare(`
    SELECT * FROM eval_runs ${where}
    ORDER BY started_at DESC
    LIMIT @limit
  `).all({
    status: filter.status,
    limit: filter.limit ?? 50,
  }) as any[];
  return rows.map(rowToEvalRun);
}

function rowToEvalRun(r: any): EvalRun {
  return {
    id: r.id, url: r.url, status: r.status as EvalRunStatus,
    startedAt: r.started_at, finishedAt: r.finished_at,
    resultNum: r.result_num, logPath: r.log_path, errorMsg: r.error_msg,
    pid: r.pid ?? null,
  };
}

export function getEvalRun(id: string): EvalRun | null {
  const row = getDbInternal().prepare("SELECT * FROM eval_runs WHERE id = ?").get(id) as any;
  if (!row) return null;
  return rowToEvalRun(row);
}

export function listRunningEvalRuns(): EvalRun[] {
  return listEvalRuns({ status: "running", limit: 1000 });
}

export function markOrphanDead(id: string, errorMsg: string = "Process exited while server was offline"): void {
  getDbInternal().prepare(`
    UPDATE eval_runs
    SET status = 'failed',
        finished_at = @now,
        error_msg = @error_msg
    WHERE id = @id AND status = 'running'
  `).run({ id, now: Date.now(), error_msg: errorMsg });
}

/**
 * PID-aware boot reconciliation. For each row currently marked `running`:
 *   - If `pid` is null (legacy row from before v2 schema) → mark failed.
 *   - If pid liveness check passes → keep as running (orphan-alive).
 *   - Otherwise → mark failed.
 *
 * `isPidAlive` is injected so this module stays free of OS imports.
 */
export function reconcileRunsOnBoot(isPidAlive: (pid: number) => boolean): { swept: number; kept: number } {
  let swept = 0, kept = 0;
  const rows = listRunningEvalRuns();
  for (const row of rows) {
    if (row.pid === null) {
      markOrphanDead(row.id, "Server restarted (no PID recorded)");
      swept++;
    } else if (isPidAlive(row.pid)) {
      kept++;
    } else {
      markOrphanDead(row.id, "Process exited while server was offline");
      swept++;
    }
  }
  return { swept, kept };
}

/**
 * Deprecated: use reconcileRunsOnBoot instead. Kept as a passthrough so
 * older callers/tests still compile. Treats every running row as dead.
 */
export function sweepStaleEvalRuns(): number {
  const rows = listRunningEvalRuns();
  for (const row of rows) markOrphanDead(row.id, "Server restarted while run was active");
  return rows.length;
}
