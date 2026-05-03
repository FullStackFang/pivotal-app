// Helpers around `yaml` Document API so the profile form can read/write
// fields without losing comments, blank lines, or block-scalar formatting.

import { parseDocument, isMap, isSeq, type Document, type YAMLMap, type YAMLSeq } from "yaml";

export type DocPath = ReadonlyArray<string | number>;

export function parse(text: string): Document {
  // keepSourceTokens=false keeps memory low; comments still survive via toString.
  return parseDocument(text);
}

export function serialize(doc: Document): string {
  // lineWidth: 80 keeps prose readable. defaultKeyType "PLAIN" keeps map keys
  // unquoted (matches existing project style: `name:` not `"name":`).
  const out = doc.toString({
    lineWidth: 80,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  });
  return out.endsWith("\n") ? out : out + "\n";
}

export function getString(doc: Document, path: DocPath): string {
  const v = doc.getIn(path, false);
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export function setString(doc: Document, path: DocPath, value: string): void {
  // Empty optional values become empty strings rather than `null` so YAML stays
  // human-readable: `linkedin: ""` is friendlier than `linkedin:`.
  doc.setIn(path, value);
}

export function getStringList(doc: Document, path: DocPath): string[] {
  const node = doc.getIn(path, true);
  if (!node || !isSeq(node)) return [];
  const seq = node as YAMLSeq;
  const out: string[] = [];
  for (const item of seq.items) {
    // toJSON gracefully handles scalars; fall back to empty string.
    const j = (item as { toJSON?: () => unknown }).toJSON?.() ?? item;
    out.push(typeof j === "string" ? j : j == null ? "" : String(j));
  }
  return out;
}

export function setStringList(doc: Document, path: DocPath, values: ReadonlyArray<string>): void {
  doc.setIn(path, values.slice());
}

export interface ObjectListItem {
  [field: string]: string;
}

export function getObjectList(
  doc: Document,
  path: DocPath,
  fields: ReadonlyArray<string>,
): ObjectListItem[] {
  const node = doc.getIn(path, true);
  if (!node || !isSeq(node)) return [];
  const seq = node as YAMLSeq;
  const out: ObjectListItem[] = [];
  for (const item of seq.items) {
    if (!isMap(item)) {
      out.push(blankObject(fields));
      continue;
    }
    const map = item as YAMLMap;
    const row: ObjectListItem = {};
    for (const f of fields) {
      const v = map.get(f, false);
      row[f] =
        typeof v === "string"
          ? v
          : v == null
          ? ""
          : String(v);
    }
    out.push(row);
  }
  return out;
}

export function setObjectList(
  doc: Document,
  path: DocPath,
  fields: ReadonlyArray<string>,
  rows: ReadonlyArray<ObjectListItem>,
): void {
  // Use plain JS arrays of plain objects — yaml handles serialization.
  // Field order is preserved by iterating the schema's `fields` order.
  const out = rows.map((row) => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f] = row[f] ?? "";
    return o;
  });
  doc.setIn(path, out);
}

export function blankObject(fields: ReadonlyArray<string>): ObjectListItem {
  const o: ObjectListItem = {};
  for (const f of fields) o[f] = "";
  return o;
}

/** Convert "candidate.full_name" → ["candidate", "full_name"]. */
export function toPath(dotted: string): string[] {
  return dotted.split(".");
}
