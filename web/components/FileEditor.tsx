"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UserFileMeta } from "./ProfileView";

type SaveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string; line?: number; column?: number };

interface Props {
  fileKey: string;
  meta: UserFileMeta;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const HINTS: Record<string, string[]> = {
  profile: [
    "candidate.full_name, .email, .phone, .location, .linkedin, .portfolio_url",
    "target_roles.primary — list of role titles you are optimizing for",
    "target_roles.archetypes — fit weighting, primary | secondary | adjacent",
    "compensation.target_range, .minimum, .currency",
    "location.country, .city, .timezone, .visa_status",
  ],
  cv: [
    "Top of file: name, contact line, summary",
    "## Work Experience — most recent first; #### Company subsections",
    "## Education / Skills / Certifications",
    "Used as the source of truth for /career-ops pdf",
  ],
  narrative: [
    "Your archetypes table — the fit categories used in scoring",
    "Adaptive framing — proof points to emphasise per archetype",
    "Hard skip rules — auto-filter rules that mark roles SKIP",
    "Negotiation script — used when offers come in",
  ],
  "proof-points": [
    "One section per project, with a hero metric",
    "Keep entries tight — the agent quotes hero metrics verbatim",
  ],
  portals: [
    "title_filter.positive / .negative — keyword whitelist & blacklist",
    "companies — list with { name, careers_url, ats } per entry",
    "queries — broad WebSearch queries with site: filters",
  ],
};

export function FileEditor({ fileKey, meta, onSaved, onDirtyChange }: Props) {
  const [original, setOriginal] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [state, setState] = useState<SaveState>({ kind: "loading" });
  const [showHints, setShowHints] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Load file body once per key.
  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/user-files/${fileKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { file?: { content: string }; error?: string }) => {
        if (cancelled) return;
        if (!data.file) {
          setState({ kind: "error", message: data.error ?? "Could not load file." });
          return;
        }
        setOriginal(data.file.content);
        setContent(data.file.content);
        setState({ kind: "idle" });
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [fileKey]);

  const dirty = content !== original;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Warn before navigating away from unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!dirty) return;
    setState({ kind: "saving" });
    try {
      const res = await fetch(`/api/user-files/${fileKey}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message: data.message ?? data.error ?? "Save failed.",
          line: data.line,
          column: data.column,
        });
        return;
      }
      setOriginal(content);
      setState({ kind: "saved", at: Date.now() });
      onSaved();
    } catch (e) {
      setState({ kind: "error", message: String(e) });
    }
  }, [content, dirty, fileKey, onSaved]);

  // Cmd/Ctrl+S to save.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  // Tab inserts two spaces inside the editor (instead of focus shift).
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = content.slice(0, start) + "  " + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
  }

  function revert() {
    if (!dirty) return;
    if (!window.confirm("Discard unsaved changes?")) return;
    setContent(original);
    setState({ kind: "idle" });
  }

  const lineCount = useMemo(() => content.split("\n").length, [content]);
  const charCount = content.length;

  const updatedLabel = formatRelative(meta.updatedAt);

  return (
    <section className="editor">
      <header className="editor-head">
        <div className="editor-head-main">
          <div className="editor-id">
            <span className="editor-format">{meta.format}</span>
            <code className="editor-path">{meta.relPath}</code>
          </div>
          <h2 className="editor-label">{meta.label}</h2>
          <p className="editor-desc">{meta.description}</p>
        </div>
        <div className="editor-stats">
          <div className="editor-stat">
            <span className="editor-stat-lbl">Lines</span>
            <span className="editor-stat-val">{lineCount}</span>
          </div>
          <div className="editor-stat">
            <span className="editor-stat-lbl">Bytes</span>
            <span className="editor-stat-val">{charCount}</span>
          </div>
          <div className="editor-stat">
            <span className="editor-stat-lbl">On disk</span>
            <span className="editor-stat-val">
              {meta.exists ? updatedLabel : "—"}
            </span>
          </div>
        </div>
      </header>

      <div className="editor-body">
        <div className="editor-main">
          {state.kind === "error" && (
            <div className="editor-banner err">
              <span className="banner-tag">{state.line ? "Validation" : "Error"}</span>
              <span className="banner-msg">{state.message}</span>
              {state.line && (
                <span className="banner-pos">
                  line {state.line}
                  {state.column ? `:${state.column}` : ""}
                </span>
              )}
            </div>
          )}
          {!meta.exists && (
            <div className="editor-banner info">
              <span className="banner-tag">New</span>
              <span className="banner-msg">
                File doesn&apos;t exist yet. Save once to create it at{" "}
                <code>{meta.relPath}</code>.
              </span>
            </div>
          )}
          {meta.exists && meta.isPristine && (
            <div className="editor-banner info">
              <span className="banner-tag">Template</span>
              <span className="banner-msg">
                Still matches the bundled template. Personalise it before running an
                evaluation.
              </span>
            </div>
          )}
          <textarea
            ref={taRef}
            className={`editor-area fmt-${meta.format}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={meta.format === "markdown"}
            wrap="off"
            aria-label={`${meta.label} content`}
          />
        </div>

        {showHints && HINTS[fileKey] && (
          <aside className="editor-hints">
            <header>
              <h4>Schema</h4>
              <button
                className="hint-close"
                onClick={() => setShowHints(false)}
                aria-label="Hide schema hints"
              >
                ×
              </button>
            </header>
            <ul>
              {HINTS[fileKey].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <footer className="editor-foot">
        <div className="editor-foot-status">
          <SaveStatusBadge state={state} dirty={dirty} />
        </div>
        <div className="editor-foot-actions">
          {HINTS[fileKey] && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowHints((s) => !s)}
            >
              {showHints ? "Hide" : "Schema"}
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={revert}
            disabled={!dirty || state.kind === "saving"}
          >
            Revert
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={save}
            disabled={!dirty || state.kind === "saving" || state.kind === "loading"}
          >
            <span className="btn-kbd">⌘S</span>
            {state.kind === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </footer>
    </section>
  );
}

function SaveStatusBadge({ state, dirty }: { state: SaveState; dirty: boolean }) {
  if (state.kind === "loading") {
    return <span className="save-badge muted">Loading…</span>;
  }
  if (state.kind === "saving") {
    return (
      <span className="save-badge live">
        <span className="pulse" /> Writing to disk…
      </span>
    );
  }
  if (state.kind === "error") {
    return <span className="save-badge err">Not saved</span>;
  }
  if (dirty) {
    return <span className="save-badge dirty">Unsaved changes</span>;
  }
  if (state.kind === "saved") {
    return (
      <span className="save-badge ok">
        Saved {formatRelative(state.at)}
      </span>
    );
  }
  return <span className="save-badge muted">Idle</span>;
}

function formatRelative(at: number | null): string {
  if (!at) return "never";
  const delta = Date.now() - at;
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
  const d = new Date(at);
  return d.toISOString().slice(0, 10);
}
