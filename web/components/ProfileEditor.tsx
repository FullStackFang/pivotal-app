"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UserFileMeta } from "./ProfileView";
import { ProfileForm } from "./ProfileForm";

type SaveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string; line?: number; column?: number };

type ViewMode = "form" | "raw";

interface Props {
  fileKey: string;
  meta: UserFileMeta;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function ProfileEditor({ fileKey, meta, onSaved, onDirtyChange }: Props) {
  const [original, setOriginal] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [state, setState] = useState<SaveState>({ kind: "loading" });
  const [view, setView] = useState<ViewMode>("form");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Load the file body once per key.
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

      <div className="editor-toolbar">
        <div className="view-toggle" role="tablist" aria-label="Edit mode">
          <button
            role="tab"
            aria-selected={view === "form"}
            className={`view-toggle-btn ${view === "form" ? "is-on" : ""}`}
            onClick={() => setView("form")}
          >
            Form
          </button>
          <button
            role="tab"
            aria-selected={view === "raw"}
            className={`view-toggle-btn ${view === "raw" ? "is-on" : ""}`}
            onClick={() => setView("raw")}
          >
            Raw YAML
          </button>
        </div>
      </div>

      <div className="editor-body editor-body-form">
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

          {state.kind === "loading" ? (
            <p className="editor-loading">Loading…</p>
          ) : view === "form" ? (
            <ProfileForm content={content} onChange={setContent} />
          ) : (
            <textarea
              ref={taRef}
              className="editor-area fmt-yaml"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              wrap="off"
              aria-label={`${meta.label} raw YAML`}
            />
          )}
        </div>
      </div>

      <footer className="editor-foot">
        <div className="editor-foot-status">
          <SaveStatusBadge state={state} dirty={dirty} />
        </div>
        <div className="editor-foot-actions">
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
    return <span className="save-badge ok">Saved {formatRelative(state.at)}</span>;
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
