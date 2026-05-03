"use client";
import { useState, useMemo } from "react";
import type { PortalCompany } from "@/lib/portalsShared";
import { AddPortalModal } from "./AddPortalModal";

type Filter = "all" | "priority" | "matchable" | "disabled";

export function PortalsManager({
  initialCompanies,
  fileExists,
}: {
  initialCompanies: PortalCompany[];
  fileExists: boolean;
}) {
  const [companies, setCompanies] = useState<PortalCompany[]>(initialCompanies);
  const [filter, setFilter] = useState<Filter>("all");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return companies.filter(c => {
      if (filter === "priority") return c.priority;
      if (filter === "matchable") return c.matchable;
      if (filter === "disabled") return !c.enabled;
      return true;
    });
  }, [companies, filter]);

  const stats = useMemo(() => {
    const enabled = companies.filter(c => c.enabled).length;
    const priority = companies.filter(c => c.enabled && c.priority).length;
    const matchable = companies.filter(c => c.enabled && c.matchable).length;
    return { total: companies.length, enabled, priority, matchable };
  }, [companies]);

  async function patch(slug: string, patch: Partial<Pick<PortalCompany, "enabled" | "priority">>) {
    setBusySlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/portals/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = await res.json() as { company: PortalCompany };
      setCompanies(prev => prev.map(c => c.slug === slug ? data.company : c));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySlug(null);
    }
  }

  async function remove(slug: string) {
    if (!confirm("Remove this company from portals.yml?")) return;
    setBusySlug(slug);
    setError(null);
    try {
      const res = await fetch(`/api/portals/${slug}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setCompanies(prev => prev.filter(c => c.slug !== slug));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySlug(null);
    }
  }

  function handleAdded(c: PortalCompany) {
    setCompanies(prev => [...prev, c]);
    setModalOpen(false);
  }

  if (!fileExists) {
    return (
      <div className="portals-empty">
        <h2>portals.yml not found</h2>
        <p>Create one from <code>templates/portals.example.yml</code> first.</p>
      </div>
    );
  }

  return (
    <div className="portals-shell">
      <div className="head">
        <h1 className="title">Portals</h1>
        <p className="lede">
          The companies your scans hit. Toggle priority on the ones you want
          included in scheduled scans.
        </p>
      </div>

      <div className="portals-controls">
        <div className="portals-filters">
          <FilterPill label={`All ${stats.total}`} active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterPill label={`Priority ${stats.priority}`} active={filter === "priority"} onClick={() => setFilter("priority")} />
          <FilterPill label={`Matchable ${stats.matchable}`} active={filter === "matchable"} onClick={() => setFilter("matchable")} />
          <FilterPill label={`Disabled ${stats.total - stats.enabled}`} active={filter === "disabled"} onClick={() => setFilter("disabled")} />
        </div>
        <button className="btn primary" onClick={() => setModalOpen(true)}>
          + Add company
        </button>
      </div>

      {error && <div className="portals-error">{error}</div>}

      {stats.matchable === 0 && (
        <div className="scan-warning">
          <strong>No companies are scannable yet.</strong> None of the enabled companies have a
          recognized Greenhouse, Ashby, or Lever URL. Update a <code>careers_url</code> to one of
          those portals or add a new company below.
        </div>
      )}

      <div className="portals-table-wrap">
        <table className="portals-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Portal</th>
              <th style={{ width: 90 }}>Enabled</th>
              <th style={{ width: 90 }}>Priority</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.slug} className={!c.enabled ? "is-disabled" : ""}>
                <td>
                  <div className="portal-name">{c.name}</div>
                  <div className="portal-url">
                    <a href={c.careersUrl} target="_blank" rel="noopener noreferrer">
                      {c.careersUrl}
                    </a>
                  </div>
                  {c.notes && <div className="portal-notes">{c.notes}</div>}
                </td>
                <td>
                  {c.apiType ? (
                    <span className={`portal-badge portal-${c.apiType.toLowerCase()}`}>
                      {c.apiType}
                    </span>
                  ) : (
                    <span className="portal-badge portal-none">No API</span>
                  )}
                </td>
                <td>
                  <Toggle
                    on={c.enabled}
                    busy={busySlug === c.slug}
                    onChange={(v) => patch(c.slug, { enabled: v })}
                    label={`Enable ${c.name}`}
                  />
                </td>
                <td>
                  <Toggle
                    on={c.priority}
                    busy={busySlug === c.slug}
                    onChange={(v) => patch(c.slug, { priority: v })}
                    label={`Priority ${c.name}`}
                  />
                </td>
                <td>
                  <button
                    className="btn small ghost"
                    onClick={() => remove(c.slug)}
                    disabled={busySlug === c.slug}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="portals-empty-row">
                  Nothing matches this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <AddPortalModal
          onAdded={handleAdded}
          onClose={() => setModalOpen(false)}
          existingSlugs={new Set(companies.map(c => c.slug))}
        />
      )}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`filter-pill ${active ? "is-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function Toggle({
  on,
  busy,
  onChange,
  label,
}: {
  on: boolean;
  busy: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${on ? "is-on" : "is-off"} ${busy ? "is-busy" : ""}`}
      onClick={() => onChange(!on)}
      disabled={busy}
      aria-label={label}
      aria-pressed={on}
    >
      <span className="toggle-knob" />
    </button>
  );
}
