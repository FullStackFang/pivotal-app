"use client";
import { useCallback, useMemo } from "react";
import type {
  Schema,
  SchemaSection,
  ScalarField,
  StringListField,
  ObjectListField,
  AnyField,
} from "@/lib/data/yamlForm";
import {
  parse,
  serialize,
  getString,
  setString,
  getBoolean,
  setBoolean,
  getStringList,
  setStringList,
  getObjectList,
  setObjectList,
  toPath,
  type ObjectListItem,
  type FieldValue,
} from "@/lib/data/profileDoc";
import { Hint } from "./Hint";

interface Props {
  /** The schema describing sections + fields. See `lib/data/yamlForm.ts`. */
  schema: Schema;
  /** Current YAML text. The form parses on every render — cheap for our file sizes. */
  content: string;
  /** Called with the serialized YAML each time the user edits a field. */
  onChange: (next: string) => void;
  /** Optional id prefix so multiple forms on the same page don't collide on
   *  section anchor ids. Defaults to "section". */
  anchorPrefix?: string;
  /** ARIA label for the section nav. */
  navLabel?: string;
}

export function YamlSchemaForm({
  schema,
  content,
  onChange,
  anchorPrefix = "section",
  navLabel = "Sections",
}: Props) {
  const doc = useMemo(() => parse(content), [content]);

  const update = useCallback(
    (mutate: (d: ReturnType<typeof parse>) => void) => {
      mutate(doc);
      onChange(serialize(doc));
    },
    [doc, onChange],
  );

  return (
    <div className="profile-form">
      <nav className="profile-form-nav" aria-label={navLabel}>
        {schema.map((s) => (
          <a key={s.key} href={`#${anchorPrefix}-${s.key}`} className="profile-form-nav-item">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="profile-form-body">
        {schema.map((section) => (
          <Section
            key={section.key}
            section={section}
            anchorId={`${anchorPrefix}-${section.key}`}
            doc={doc}
            update={update}
          />
        ))}
      </div>
    </div>
  );
}

interface SectionProps {
  section: SchemaSection;
  anchorId: string;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}

function Section({ section, anchorId, doc, update }: SectionProps) {
  return (
    <section className="form-section" id={anchorId}>
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
  return f.key;
}

interface FieldRowProps {
  field: AnyField;
  doc: ReturnType<typeof parse>;
  update: (m: (d: ReturnType<typeof parse>) => void) => void;
}

function FieldRow({ field, doc, update }: FieldRowProps) {
  if (field.kind === "list-string") {
    return <StringListInput field={field} doc={doc} update={update} />;
  }
  if (field.kind === "list-object") {
    return <ObjectListInput field={field} doc={doc} update={update} />;
  }
  return <ScalarInput field={field} doc={doc} update={update} />;
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

  if (field.kind === "boolean") {
    const value = getBoolean(doc, path);
    const onChange = (v: boolean) => update((d) => setBoolean(d, path, v));
    return (
      <div className="field">
        <FieldLabel field={field} />
        <BooleanControl value={value} onChange={onChange} label={field.label} />
      </div>
    );
  }

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

function BooleanControl({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className={`field-toggle ${value ? "is-on" : ""}`}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="field-toggle-track" aria-hidden>
        <span className="field-toggle-thumb" />
      </span>
      <span className="field-toggle-state" aria-hidden>{value ? "ON" : "OFF"}</span>
    </label>
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
  // Sub-field keys are RELATIVE — just the field name, no dot path.
  const fieldKeys = field.fields.map((f) => f.key);
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
                const writeRow = (newVal: FieldValue) => {
                  const next = items.slice();
                  next[i] = { ...row, [sub.key]: newVal };
                  replace(next);
                };
                if (sub.kind === "boolean") {
                  const boolVal = typeof row[sub.key] === "boolean" ? (row[sub.key] as boolean) : false;
                  return (
                    <div key={sub.key} className="field field-sub">
                      <FieldLabel field={sub} />
                      <BooleanControl value={boolVal} onChange={writeRow} label={sub.label} />
                    </div>
                  );
                }
                const strVal = typeof row[sub.key] === "string" ? (row[sub.key] as string) : "";
                return (
                  <div key={sub.key} className="field field-sub">
                    <FieldLabel field={sub} />
                    <FieldControl
                      field={sub}
                      value={strVal}
                      onChange={writeRow}
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
            // Type-correct blank row — booleans default to false, others to "".
            const blank: ObjectListItem = {};
            for (const sub of field.fields) {
              blank[sub.key] = sub.kind === "boolean" ? false : "";
            }
            replace([...items, blank]);
          }}
        >
          + Add {field.itemLabel.toLowerCase()}
        </button>
      </div>
    </div>
  );
}
