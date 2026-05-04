"use client";
import { useCallback, useMemo } from "react";
import {
  parse,
  serialize,
  type CvDoc,
  type Section,
  type HeaderSection,
  type ProseSection,
  type ListSection,
  type ExperienceSection,
  type ExperienceJob,
  type ExperienceSub,
  type EducationSection,
  type EducationEntry,
  type RawSection,
  type ContactPair,
} from "@/lib/data/cvDoc";
import { Hint } from "./Hint";

interface Props {
  content: string;
  onChange: (next: string) => void;
}

export function CvForm({ content, onChange }: Props) {
  const doc = useMemo<CvDoc>(() => parse(content), [content]);

  const update = useCallback(
    (mutate: (d: CvDoc) => void) => {
      // Clone-on-mutate to keep referential changes simple. We re-serialize on
      // every edit; cv.md fits comfortably in memory so the cost is trivial.
      const cloned: CvDoc = { sections: doc.sections.map(cloneSection) };
      mutate(cloned);
      onChange(serialize(cloned));
    },
    [doc, onChange],
  );

  return (
    <div className="profile-form">
      <nav className="profile-form-nav" aria-label="CV sections">
        {doc.sections.map((s, i) => (
          <a key={i} href={`#cv-section-${i}`} className="profile-form-nav-item">
            {sectionNavLabel(s)}
          </a>
        ))}
      </nav>
      <div className="profile-form-body">
        {doc.sections.map((section, idx) => (
          <SectionCard
            key={idx}
            id={`cv-section-${idx}`}
            section={section}
            onChange={(next) =>
              update((d) => {
                d.sections[idx] = next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function sectionNavLabel(s: Section): string {
  if (s.kind === "header") return s.name || "Header";
  return s.title;
}

function cloneSection(s: Section): Section {
  return JSON.parse(JSON.stringify(s));
}

interface SectionCardProps {
  id: string;
  section: Section;
  onChange: (next: Section) => void;
}

function SectionCard({ id, section, onChange }: SectionCardProps) {
  return (
    <section className="form-section" id={id}>
      <header className="form-section-head">
        <h3 className="form-section-title">{sectionNavLabel(section)}</h3>
        <p className="form-section-desc">{sectionDesc(section)}</p>
      </header>
      <div className="form-section-fields">
        {section.kind === "header" && (
          <HeaderEditor section={section} onChange={onChange} />
        )}
        {section.kind === "prose" && (
          <ProseEditor section={section} onChange={onChange} />
        )}
        {section.kind === "list" && (
          <ListEditor section={section} onChange={onChange} />
        )}
        {section.kind === "experience" && (
          <ExperienceEditor section={section} onChange={onChange} />
        )}
        {section.kind === "education" && (
          <EducationEditor section={section} onChange={onChange} />
        )}
        {section.kind === "raw" && (
          <RawEditor section={section} onChange={onChange} />
        )}
      </div>
    </section>
  );
}

function sectionDesc(s: Section): string {
  switch (s.kind) {
    case "header":
      return "Top-of-CV identity. Used in PDF exports and tracker rows.";
    case "prose":
      return "Free-form prose. Multi-paragraph supported.";
    case "list":
      return "Bullet list. Each line becomes one bullet.";
    case "experience":
      return "Roles and engagements. Each job has bullets and optional sub-engagements.";
    case "education":
      return "Schools, degrees, and dates.";
    case "raw":
      return "Custom section — edit as raw markdown. Tables and arbitrary content are preserved.";
  }
}

// =========== Header editor ===========

function HeaderEditor({
  section,
  onChange,
}: {
  section: HeaderSection;
  onChange: (next: HeaderSection) => void;
}) {
  const updateContact = (i: number, patch: Partial<ContactPair>) => {
    const next = section.contacts.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...section, contacts: next });
  };

  return (
    <>
      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Name</span>
          <Hint text="Your full name as it appears at the top of the CV." />
        </div>
        <input
          className="field-input"
          value={section.name}
          onChange={(e) => onChange({ ...section, name: e.target.value })}
          placeholder="Jane Smith"
        />
      </div>

      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Contact pairs</span>
          <Hint text="Bold key followed by value. Optional URL turns the value into a markdown link." />
        </div>
        <div className="field-list field-list-obj">
          {section.contacts.length === 0 && (
            <p className="field-empty">No contact pairs yet.</p>
          )}
          {section.contacts.map((c, i) => (
            <div key={i} className="field-obj-row">
              <header className="field-obj-row-head">
                <span className="field-obj-row-num">Pair {i + 1}</span>
                <button
                  type="button"
                  className="btn ghost field-list-del"
                  onClick={() =>
                    onChange({
                      ...section,
                      contacts: section.contacts.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove
                </button>
              </header>
              <div className="field-obj-row-body">
                <div className="field field-sub">
                  <div className="field-label">
                    <span className="field-label-text">Label</span>
                  </div>
                  <input
                    className="field-input"
                    value={c.label}
                    onChange={(e) => updateContact(i, { label: e.target.value })}
                    placeholder="Email / LinkedIn / Phone"
                  />
                </div>
                <div className="field field-sub">
                  <div className="field-label">
                    <span className="field-label-text">Value</span>
                  </div>
                  <input
                    className="field-input"
                    value={c.value}
                    onChange={(e) => updateContact(i, { value: e.target.value })}
                    placeholder="Display text"
                  />
                </div>
                <div className="field field-sub">
                  <div className="field-label">
                    <span className="field-label-text">URL</span>
                    <span className="field-opt">optional</span>
                  </div>
                  <input
                    className="field-input"
                    value={c.href ?? ""}
                    onChange={(e) =>
                      updateContact(i, {
                        href: e.target.value.trim() === "" ? undefined : e.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn field-list-add"
            onClick={() =>
              onChange({
                ...section,
                contacts: [...section.contacts, { label: "", value: "" }],
              })
            }
          >
            + Add pair
          </button>
        </div>
      </div>
    </>
  );
}

// =========== Prose editor ===========

function ProseEditor({
  section,
  onChange,
}: {
  section: ProseSection;
  onChange: (next: ProseSection) => void;
}) {
  return (
    <>
      <SectionTitleField title={section.title} onTitleChange={(t) => onChange({ ...section, title: t })} />
      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Body</span>
          <Hint text="Plain prose. Multi-paragraph supported via blank lines. Markdown is allowed." />
        </div>
        <textarea
          className="field-input field-textarea"
          value={section.body}
          rows={Math.max(4, Math.min(12, section.body.split("\n").length + 1))}
          onChange={(e) => onChange({ ...section, body: e.target.value })}
        />
      </div>
    </>
  );
}

// =========== List editor ===========

function ListEditor({
  section,
  onChange,
}: {
  section: ListSection;
  onChange: (next: ListSection) => void;
}) {
  const replace = (items: string[]) => onChange({ ...section, items });
  return (
    <>
      <SectionTitleField title={section.title} onTitleChange={(t) => onChange({ ...section, title: t })} />
      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Items</span>
          <Hint text="One bullet per line. Markdown bold/italic inside an item is preserved." />
        </div>
        <div className="field-list">
          {section.items.length === 0 && <p className="field-empty">No items yet.</p>}
          {section.items.map((val, i) => (
            <div key={i} className="field-list-row">
              <input
                className="field-input"
                value={val}
                onChange={(e) => {
                  const next = section.items.slice();
                  next[i] = e.target.value;
                  replace(next);
                }}
                aria-label={`Item ${i + 1}`}
              />
              <button
                type="button"
                className="btn ghost field-list-del"
                onClick={() => replace(section.items.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn field-list-add"
            onClick={() => replace([...section.items, ""])}
          >
            + Add item
          </button>
        </div>
      </div>
    </>
  );
}

// =========== Experience editor ===========

function ExperienceEditor({
  section,
  onChange,
}: {
  section: ExperienceSection;
  onChange: (next: ExperienceSection) => void;
}) {
  const updateJob = (i: number, patch: Partial<ExperienceJob>) => {
    const next = section.jobs.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...section, jobs: next });
  };
  const addJob = () =>
    onChange({
      ...section,
      jobs: [
        ...section.jobs,
        {
          company: "",
          location: "",
          title: "",
          dates: "",
          context: "",
          description: "",
          bullets: [],
          subEngagements: [],
        },
      ],
    });
  const removeJob = (i: number) =>
    onChange({ ...section, jobs: section.jobs.filter((_, j) => j !== i) });

  return (
    <>
      <SectionTitleField title={section.title} onTitleChange={(t) => onChange({ ...section, title: t })} />
      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Roles</span>
          <Hint text="Each entry becomes a `### Company — Location` block in the CV. Bullets are quantified achievements." />
        </div>
        <div className="field-list field-list-obj">
          {section.jobs.length === 0 && <p className="field-empty">No roles yet.</p>}
          {section.jobs.map((job, i) => (
            <JobEditor
              key={i}
              index={i}
              job={job}
              onChange={(patch) => updateJob(i, patch)}
              onRemove={() => removeJob(i)}
            />
          ))}
          <button type="button" className="btn field-list-add" onClick={addJob}>
            + Add role
          </button>
        </div>
      </div>
    </>
  );
}

function JobEditor({
  index,
  job,
  onChange,
  onRemove,
}: {
  index: number;
  job: ExperienceJob;
  onChange: (patch: Partial<ExperienceJob>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="field-obj-row">
      <header className="field-obj-row-head">
        <span className="field-obj-row-num">Role {index + 1}</span>
        <button type="button" className="btn ghost field-list-del" onClick={onRemove}>
          Remove role
        </button>
      </header>
      <div className="field-obj-row-body">
        <div className="field field-sub">
          <div className="field-label">
            <span className="field-label-text">Company</span>
          </div>
          <input
            className="field-input"
            value={job.company}
            onChange={(e) => onChange({ company: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
        <div className="field field-sub">
          <div className="field-label">
            <span className="field-label-text">Location</span>
            <span className="field-opt">optional</span>
          </div>
          <input
            className="field-input"
            value={job.location ?? ""}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Remote / New York, NY"
          />
        </div>
        <div className="field field-sub">
          <div className="field-label">
            <span className="field-label-text">Job title</span>
            <Hint text="Bold line beneath the heading. Becomes `**Title**`." />
          </div>
          <input
            className="field-input"
            value={job.title ?? ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Principal Engineer"
          />
        </div>
        <div className="field field-sub">
          <div className="field-label">
            <span className="field-label-text">Dates</span>
            <Hint text="Italic line. e.g. `Jan 2022 – Present`." />
          </div>
          <input
            className="field-input"
            value={job.dates ?? ""}
            onChange={(e) => onChange({ dates: e.target.value })}
            placeholder="Jan 2022 – Present"
          />
        </div>
      </div>
      <div className="field-obj-row-body">
        <div className="field field-sub" style={{ gridColumn: "1 / -1" }}>
          <div className="field-label">
            <span className="field-label-text">Context</span>
            <span className="field-opt">optional</span>
            <Hint text="Italic line under dates — e.g. `Series-C startup, 200 employees`." />
          </div>
          <input
            className="field-input"
            value={job.context ?? ""}
            onChange={(e) => onChange({ context: e.target.value })}
            placeholder="Series-C startup, 200 employees"
          />
        </div>
        <div className="field field-sub" style={{ gridColumn: "1 / -1" }}>
          <div className="field-label">
            <span className="field-label-text">Lead description</span>
            <span className="field-opt">optional</span>
            <Hint text="Prose paragraph between dates and bullets. Useful for advisory/consulting roles." />
          </div>
          <textarea
            className="field-input field-textarea"
            value={job.description ?? ""}
            rows={Math.max(2, Math.min(6, (job.description ?? "").split("\n").length + 1))}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="field field-sub" style={{ gridColumn: "1 / -1" }}>
          <div className="field-label">
            <span className="field-label-text">Bullets</span>
            <Hint text="One achievement per bullet. Lead with `**Topic**` for scan-ability. Quantify outcomes." />
          </div>
          <BulletsList
            items={job.bullets}
            onChange={(b) => onChange({ bullets: b })}
            placeholder="**Platform Migration** – Cut p95 latency 40%."
          />
        </div>
        <div className="field field-sub" style={{ gridColumn: "1 / -1" }}>
          <div className="field-label">
            <span className="field-label-text">Sub-engagements</span>
            <span className="field-opt">optional</span>
            <Hint text="Used for advisory roles where one umbrella company has multiple client engagements. Each sub becomes a `#### Heading` block." />
          </div>
          <SubsEditor
            subs={job.subEngagements}
            onChange={(s) => onChange({ subEngagements: s })}
          />
        </div>
      </div>
    </div>
  );
}

function BulletsList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="field-list">
      {items.length === 0 && <p className="field-empty">No bullets yet.</p>}
      {items.map((val, i) => (
        <div key={i} className="field-list-row">
          <input
            className="field-input"
            value={val}
            placeholder={placeholder}
            onChange={(e) => {
              const next = items.slice();
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="btn ghost field-list-del"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn field-list-add"
        onClick={() => onChange([...items, ""])}
      >
        + Add bullet
      </button>
    </div>
  );
}

function SubsEditor({
  subs,
  onChange,
}: {
  subs: ExperienceSub[];
  onChange: (next: ExperienceSub[]) => void;
}) {
  const update = (i: number, patch: Partial<ExperienceSub>) => {
    const next = subs.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  return (
    <div className="field-list field-list-obj">
      {subs.length === 0 && <p className="field-empty">No sub-engagements.</p>}
      {subs.map((sub, i) => (
        <div key={i} className="field-obj-row">
          <header className="field-obj-row-head">
            <span className="field-obj-row-num">Sub {i + 1}</span>
            <button
              type="button"
              className="btn ghost field-list-del"
              onClick={() => onChange(subs.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </header>
          <div className="field-obj-row-body">
            <div className="field field-sub" style={{ gridColumn: "1 / -1" }}>
              <div className="field-label">
                <span className="field-label-text">Heading</span>
              </div>
              <input
                className="field-input"
                value={sub.heading}
                onChange={(e) => update(i, { heading: e.target.value })}
                placeholder="Client Name — Role"
              />
            </div>
            <div className="field field-sub">
              <div className="field-label">
                <span className="field-label-text">Dates</span>
                <span className="field-opt">optional</span>
              </div>
              <input
                className="field-input"
                value={sub.dates ?? ""}
                onChange={(e) => update(i, { dates: e.target.value })}
                placeholder="2024 – Present"
              />
            </div>
            <div className="field field-sub" style={{ gridColumn: "1 / -1" }}>
              <div className="field-label">
                <span className="field-label-text">Bullets</span>
              </div>
              <BulletsList
                items={sub.bullets}
                onChange={(b) => update(i, { bullets: b })}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn field-list-add"
        onClick={() =>
          onChange([...subs, { heading: "", dates: undefined, bullets: [] }])
        }
      >
        + Add sub-engagement
      </button>
    </div>
  );
}

// =========== Education editor ===========

function EducationEditor({
  section,
  onChange,
}: {
  section: EducationSection;
  onChange: (next: EducationSection) => void;
}) {
  const update = (i: number, patch: Partial<EducationEntry>) => {
    const next = section.entries.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...section, entries: next });
  };
  return (
    <>
      <SectionTitleField title={section.title} onTitleChange={(t) => onChange({ ...section, title: t })} />
      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Entries</span>
          <Hint text="School, degree, optional dates. Each entry becomes a 3-line block." />
        </div>
        <div className="field-list field-list-obj">
          {section.entries.length === 0 && <p className="field-empty">No entries yet.</p>}
          {section.entries.map((e, i) => (
            <div key={i} className="field-obj-row">
              <header className="field-obj-row-head">
                <span className="field-obj-row-num">Entry {i + 1}</span>
                <button
                  type="button"
                  className="btn ghost field-list-del"
                  onClick={() =>
                    onChange({
                      ...section,
                      entries: section.entries.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove
                </button>
              </header>
              <div className="field-obj-row-body">
                <div className="field field-sub">
                  <div className="field-label">
                    <span className="field-label-text">School</span>
                  </div>
                  <input
                    className="field-input"
                    value={e.school}
                    onChange={(ev) => update(i, { school: ev.target.value })}
                    placeholder="Cornell University"
                  />
                </div>
                <div className="field field-sub">
                  <div className="field-label">
                    <span className="field-label-text">Degree</span>
                  </div>
                  <input
                    className="field-input"
                    value={e.degree}
                    onChange={(ev) => update(i, { degree: ev.target.value })}
                    placeholder="M.S., Computer Science"
                  />
                </div>
                <div className="field field-sub">
                  <div className="field-label">
                    <span className="field-label-text">Dates</span>
                    <span className="field-opt">optional</span>
                  </div>
                  <input
                    className="field-input"
                    value={e.dates ?? ""}
                    onChange={(ev) =>
                      update(i, {
                        dates: ev.target.value.trim() === "" ? undefined : ev.target.value,
                      })
                    }
                    placeholder="Expected 2027"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn field-list-add"
            onClick={() =>
              onChange({
                ...section,
                entries: [...section.entries, { school: "", degree: "", dates: undefined }],
              })
            }
          >
            + Add entry
          </button>
        </div>
      </div>
    </>
  );
}

// =========== Raw editor ===========

function RawEditor({
  section,
  onChange,
}: {
  section: RawSection;
  onChange: (next: RawSection) => void;
}) {
  return (
    <>
      <SectionTitleField title={section.title} onTitleChange={(t) => onChange({ ...section, title: t })} />
      <div className="field">
        <div className="field-label">
          <span className="field-label-text">Markdown body</span>
          <Hint text="This section type isn't structured — edit as raw markdown. Tables, custom lists, and arbitrary content all preserved." />
        </div>
        <textarea
          className="field-input field-textarea"
          value={section.body}
          rows={Math.max(6, Math.min(20, section.body.split("\n").length + 1))}
          onChange={(e) => onChange({ ...section, body: e.target.value })}
          spellCheck
        />
      </div>
    </>
  );
}

function SectionTitleField({
  title,
  onTitleChange,
}: {
  title: string;
  onTitleChange: (t: string) => void;
}) {
  return (
    <div className="field">
      <div className="field-label">
        <span className="field-label-text">Section heading</span>
        <Hint text="Renders as `## {heading}` in markdown." />
      </div>
      <input
        className="field-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />
    </div>
  );
}
