"use client";
import { useCallback, useMemo } from "react";
import {
  PROFILE_SCHEMA,
  type SchemaSection,
  type ScalarField,
  type StringListField,
  type ObjectListField,
  type AnyField,
} from "@/lib/data/profileSchema";
import {
  parse,
  serialize,
  getString,
  setString,
  getStringList,
  setStringList,
  getObjectList,
  setObjectList,
  toPath,
  type ObjectListItem,
} from "@/lib/data/profileDoc";
import { Hint } from "./Hint";

interface Props {
  /** Current YAML text. The form parses on every render — cheap for our file sizes. */
  content: string;
  /** Called with the serialized YAML each time the user edits a field. */
  onChange: (next: string) => void;
}

export function ProfileForm({ content, onChange }: Props) {
  // Parse once per render. Mutations clone-via-serialize, then reparse on next pass.
  const doc = useMemo(() => parse(content), [content]);

  const update = useCallback(
    (mutate: (d: ReturnType<typeof parse>) => void) => {
      // Mutate the live doc, then serialize and bubble up. Re-parse on the next render
      // gives us a clean Document for the next mutation.
      mutate(doc);
      onChange(serialize(doc));
    },
    [doc, onChange],
  );

  return (
    <div className="profile-form">
      <nav className="profile-form-nav" aria-label="Profile sections">
        {PROFILE_SCHEMA.map((s) => (
          <a key={s.key} href={`#section-${s.key}`} className="profile-form-nav-item">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="profile-form-body">
        {PROFILE_SCHEMA.map((section) => (
          <Section key={section.key} section={section} doc={doc} update={update} />
        ))}
      </div>
    </div>
  );
}

interface SectionProps {
  section: SchemaSection;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}

function Section({ section, doc, update }: SectionProps) {
  return (
    <section className="form-section" id={`section-${section.key}`}>
      <header className="form-section-head">
        <h3 className="form-section-title">{section.label}</h3>
        <p className="form-section-desc">{section.description}</p>
      </header>
      <div className="form-section-fields">
        {section.fields.map((f) => (
          <FieldRow key={fieldKey(f)} field={f} doc={doc} update={update} />
        ))}
      </div>
    </section>
  );
}

function fieldKey(f: AnyField): string {
  if ("kind" in f && (f.kind === "list-string" || f.kind === "list-object")) return f.key;
  if ("key" in f) return f.key;
  return JSON.stringify(f);
}

interface FieldRowProps {
  field: AnyField;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}

function FieldRow({ field, doc, update }: FieldRowProps) {
  if ("kind" in field) {
    if (field.kind === "list-string") {
      return <StringListInput field={field} doc={doc} update={update} />;
    }
    if (field.kind === "list-object") {
      return <ObjectListInput field={field} doc={doc} update={update} />;
    }
    return <ScalarInput field={field} doc={doc} update={update} />;
  }
  return null;
}

function ScalarInput({
  field,
  doc,
  update,
}: {
  field: ScalarField;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}) {
  const path = toPath(field.key);
  const value = getString(doc, path);
  const onChange = (v: string) => update((d) => setString(d, path, v));

  return (
    <div className="field">
      <FieldLabel field={field} />
      <FieldControl field={field} value={value} onChange={onChange} />
      {field.example && (
        <p className="field-example">
          <span className="field-example-tag">Example</span>
          <span className="field-example-text">{field.example}</span>
        </p>
      )}
    </div>
  );
}

function FieldLabel({ field }: { field: ScalarField }) {
  return (
    <label className="field-label">
      <span className="field-label-text">{field.label}</span>
      {field.optional && <span className="field-opt">optional</span>}
      <Hint text={field.tooltip} />
    </label>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ScalarField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.kind === "select") {
    return (
      <select
        className="field-input field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!field.options?.includes(value) && value !== "" && (
          <option value={value}>{value}</option>
        )}
        {value === "" && <option value="">Select…</option>}
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "text") {
    return (
      <textarea
        className="field-input field-textarea"
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(8, Math.max(3, value.split("\n").length))}
      />
    );
  }
  return (
    <input
      type={field.kind === "email" ? "email" : field.kind === "url" ? "url" : "text"}
      className="field-input"
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function StringListInput({
  field,
  doc,
  update,
}: {
  field: StringListField;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}) {
  const path = toPath(field.key);
  const items = getStringList(doc, path);
  const min = field.minItems ?? 0;

  const replace = (next: string[]) => update((d) => setStringList(d, path, next));

  return (
    <div className="field">
      <div className="field-label">
        <span className="field-label-text">{field.label}</span>
        <Hint text={field.tooltip} />
      </div>
      <div className="field-list">
        {items.length === 0 && (
          <p className="field-empty">No {field.itemLabel.toLowerCase()}s yet.</p>
        )}
        {items.map((val, i) => (
          <div key={i} className="field-list-row">
            <input
              className="field-input"
              value={val}
              placeholder={field.placeholder}
              onChange={(e) => {
                const next = items.slice();
                next[i] = e.target.value;
                replace(next);
              }}
              aria-label={`${field.itemLabel} ${i + 1}`}
            />
            <button
              type="button"
              className="btn ghost field-list-del"
              onClick={() => replace(items.filter((_, j) => j !== i))}
              disabled={items.length <= min}
              aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn field-list-add"
          onClick={() => replace([...items, ""])}
        >
          + Add {field.itemLabel.toLowerCase()}
        </button>
      </div>
      {field.example && (
        <p className="field-example">
          <span className="field-example-tag">Example</span>
          <span className="field-example-text">{field.example}</span>
        </p>
      )}
    </div>
  );
}

function ObjectListInput({
  field,
  doc,
  update,
}: {
  field: ObjectListField;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}) {
  const path = toPath(field.key);
  const fieldKeys = field.fields.map((f) => f.key.split(".").pop()!);
  const items = getObjectList(doc, path, fieldKeys);

  const replace = (next: ObjectListItem[]) =>
    update((d) => setObjectList(d, path, fieldKeys, next));

  return (
    <div className="field">
      <div className="field-label">
        <span className="field-label-text">{field.label}</span>
        <Hint text={field.tooltip} />
      </div>
      <div className="field-list field-list-obj">
        {items.length === 0 && (
          <p className="field-empty">No {field.itemLabel.toLowerCase()}s yet.</p>
        )}
        {items.map((row, i) => (
          <div key={i} className="field-obj-row">
            <header className="field-obj-row-head">
              <span className="field-obj-row-num">
                {field.itemLabel} {i + 1}
              </span>
              <button
                type="button"
                className="btn ghost field-list-del"
                onClick={() => replace(items.filter((_, j) => j !== i))}
                aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}
              >
                Remove
              </button>
            </header>
            <div className="field-obj-row-body">
              {field.fields.map((sub) => {
                const subKey = sub.key.split(".").pop()!;
                return (
                  <div key={subKey} className="field field-sub">
                    <FieldLabel field={sub} />
                    <FieldControl
                      field={sub}
                      value={row[subKey] ?? ""}
                      onChange={(v) => {
                        const next = items.slice();
                        next[i] = { ...row, [subKey]: v };
                        replace(next);
                      }}
                    />
                    {sub.example && (
                      <p className="field-example">
                        <span className="field-example-tag">Example</span>
                        <span className="field-example-text">{sub.example}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn field-list-add"
          onClick={() => {
            const blank: ObjectListItem = {};
            for (const k of fieldKeys) blank[k] = "";
            replace([...items, blank]);
          }}
        >
          + Add {field.itemLabel.toLowerCase()}
        </button>
      </div>
    </div>
  );
}
