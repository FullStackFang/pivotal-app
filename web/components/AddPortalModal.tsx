"use client";
import { useEffect, useMemo, useState } from "react";
import { slugify, type PortalCompany } from "@/lib/portalsShared";

type DetectedType = "Greenhouse" | "Ashby" | "Lever" | null;

function detectType(url: string): DetectedType {
  if (/jobs\.ashbyhq\.com\//.test(url)) return "Ashby";
  if (/jobs\.lever\.co\//.test(url)) return "Lever";
  if (/job-boards(?:\.eu)?\.greenhouse\.io\//.test(url)) return "Greenhouse";
  if (/boards\.greenhouse\.io\//.test(url)) return "Greenhouse";
  return null;
}

function suggestNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    // For board URLs like job-boards.greenhouse.io/metropolis,
    // the slug after the host is the company.
    const m = u.pathname.match(/\/([^/?#]+)/);
    if (m && m[1].length > 1) {
      const slug = m[1].replace(/-/g, " ");
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    }
    // Fallback: host without subdomains
    return u.hostname.replace(/^(www\.|careers\.|jobs\.)/, "").split(".")[0];
  } catch {
    return "";
  }
}

export function AddPortalModal({
  onAdded,
  onClose,
  existingSlugs,
}: {
  onAdded: (c: PortalCompany) => void;
  onClose: () => void;
  existingSlugs: Set<string>;
}) {
  const [careersUrl, setCareersUrl] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  const detected = useMemo(() => detectType(careersUrl), [careersUrl]);

  // Auto-suggest name from URL until user edits the field
  useEffect(() => {
    if (nameTouched) return;
    if (!careersUrl) { setName(""); return; }
    setName(suggestNameFromUrl(careersUrl));
  }, [careersUrl, nameTouched]);

  const slug = slugify(name);
  const conflict = slug && existingSlugs.has(slug);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (conflict) {
      setError(`A company with slug "${slug}" already exists`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), careersUrl: careersUrl.trim(), priority }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      onAdded(data.company as PortalCompany);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <header>
          <h2>Add a company</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <form onSubmit={submit}>
          <label>
            <span>Careers URL</span>
            <input
              type="url"
              required
              autoFocus
              value={careersUrl}
              placeholder="https://job-boards.greenhouse.io/example"
              onChange={e => setCareersUrl(e.target.value)}
            />
            <small>
              {detected
                ? <>Detected: <strong>{detected}</strong> — this URL will scan correctly.</>
                : <>No portal type detected. Use a Greenhouse / Ashby / Lever URL for the scanner to reach it.</>
              }
            </small>
          </label>

          <label>
            <span>Company name</span>
            <input
              type="text"
              required
              value={name}
              onChange={e => { setName(e.target.value); setNameTouched(true); }}
              placeholder="Metropolis"
            />
            {conflict && (
              <small className="modal-warn">A company with slug “{slug}” already exists.</small>
            )}
          </label>

          <label className="modal-checkbox">
            <input
              type="checkbox"
              checked={priority}
              onChange={e => setPriority(e.target.checked)}
            />
            <span>Mark as priority (included in scheduled scans)</span>
          </label>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || !!conflict || !careersUrl.trim() || !name.trim()}
            >
              {busy ? "Adding…" : "Add company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
