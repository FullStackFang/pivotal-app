"use client";
import { useCallback, useMemo, useState } from "react";
import { FileEditor } from "./FileEditor";
import { ProfileEditor } from "./ProfileEditor";

export interface UserFileMeta {
  key: string;
  relPath: string;
  format: "yaml" | "markdown";
  label: string;
  description: string;
  exists: boolean;
  size: number;
  updatedAt: number | null;
  isPristine: boolean;
}

interface Props {
  initialFiles: UserFileMeta[];
}

export function ProfileView({ initialFiles }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [activeKey, setActiveKey] = useState(initialFiles[0]?.key ?? "profile");
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  const active = useMemo(
    () => files.find((f) => f.key === activeKey) ?? files[0],
    [files, activeKey],
  );

  // Refresh metadata after a save without touching the editor body.
  const reloadMeta = useCallback(() => {
    fetch("/api/user-files", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { files: UserFileMeta[] }) => setFiles(d.files))
      .catch(() => { /* ignore */ });
  }, []);

  function selectFile(key: string) {
    if (dirtyKeys.has(activeKey)) {
      const ok = window.confirm(
        "You have unsaved changes in the current file. Switch anyway?",
      );
      if (!ok) return;
      setDirtyKeys((prev) => {
        const next = new Set(prev);
        next.delete(activeKey);
        return next;
      });
    }
    setActiveKey(key);
  }

  const markDirty = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      const wasDirty = prev.has(key);
      if (wasDirty === dirty) return prev; // bail out — no change
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const onActiveSaved = useCallback(() => {
    markDirty(activeKey, false);
    reloadMeta();
  }, [activeKey, markDirty, reloadMeta]);

  const onActiveDirty = useCallback(
    (d: boolean) => markDirty(activeKey, d),
    [activeKey, markDirty],
  );

  const setupNeeded = files.filter((f) => !f.exists || f.isPristine).length;

  return (
    <div className="profile-page">
      <div className="head">
        <div className="profile-head-row">
          <div>
            <h1 className="title">
              {setupNeeded > 0 ? (
                <>Required. <em>The agent runs on this.</em></>
              ) : (
                <>Your profile. <em>The agent's source of truth.</em></>
              )}
            </h1>
            <p className="lede">
              Every evaluation, every CV, every outreach draft is built from the files
              below. Edit them here — the next run picks up the change immediately.
            </p>
          </div>
          {setupNeeded > 0 && (
            <div className="setup-pill" title="Files not yet customized">
              <span className="setup-dot" />
              {setupNeeded} file{setupNeeded === 1 ? "" : "s"} pending setup
            </div>
          )}
        </div>
      </div>

      <nav className="profile-tabs" role="tablist" aria-label="Editable files">
        {files.map((f) => {
          const isActive = f.key === activeKey;
          const isDirty = dirtyKeys.has(f.key);
          const isPending = !f.exists || f.isPristine;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={isActive}
              className={`profile-tab ${isActive ? "is-on" : ""}`}
              onClick={() => selectFile(f.key)}
            >
              <span className="profile-tab-label">{f.label}</span>
              <span className="profile-tab-meta">
                <span className="profile-tab-format">{f.format}</span>
                {isDirty && <span className="profile-tab-flag" title="Unsaved changes">●</span>}
                {!isDirty && isPending && (
                  <span className="profile-tab-flag pending" title="Not yet customized">○</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      {active && active.key === "profile" && (
        <ProfileEditor
          key={active.key}
          fileKey={active.key}
          meta={active}
          onSaved={onActiveSaved}
          onDirtyChange={onActiveDirty}
        />
      )}
      {active && active.key !== "profile" && (
        <FileEditor
          key={active.key}
          fileKey={active.key}
          meta={active}
          onSaved={onActiveSaved}
          onDirtyChange={onActiveDirty}
        />
      )}
    </div>
  );
}
