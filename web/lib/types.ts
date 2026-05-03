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

export interface ScanPosting {
  url: string;
  company: string;
  title: string;
}

export type ScanEvent =
  | { type: "started"; runId: string }
  | { type: "log"; line: string }
  | { type: "done"; runId: string; newPostings: ScanPosting[] }
  | { type: "error"; message: string; tail: string[] };

export interface AppFilter {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
