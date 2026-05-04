// Schema language for the YAML-form renderer.
//
// A schema is an array of `SchemaSection`s. Each section maps to a top-level
// YAML key and contains an ordered list of fields. Fields are one of:
//   - ScalarField     (string / text / url / email / select)
//   - StringListField (array of strings — repeatable text input)
//   - ObjectListField (array of objects — repeatable card with nested scalars)
//
// The renderer (`components/YamlSchemaForm.tsx`) is schema-agnostic: it takes
// a schema, the YAML content as a string, and an `onChange` callback. It
// reads/writes via the comment-preserving `lib/data/profileDoc.ts` helpers.
// Use this to drive any user-editable YAML in the app — profile.yml,
// portals.yml, anything else.

export type FieldKind =
  | "string"
  | "text"        // multiline
  | "url"
  | "email"
  | "select"
  | "boolean";    // checkbox — YAML scalar true/false

export interface ScalarField {
  /** Dot-separated path from the doc root, e.g. "candidate.full_name". */
  key: string;
  kind: FieldKind;
  label: string;
  placeholder?: string;
  /** Shown on hover/focus of the field's `?` indicator. */
  tooltip: string;
  /** Inline example rendered under the input as ghost text. */
  example: string;
  /** Options for `kind: "select"`. */
  options?: ReadonlyArray<string>;
  /** Marks the field visually as optional. Doesn't change validation. */
  optional?: boolean;
}

export interface StringListField {
  key: string;
  kind: "list-string";
  label: string;
  /** Singular noun for one item, e.g. "Role title". */
  itemLabel: string;
  tooltip: string;
  example: string;
  placeholder?: string;
  /** Disable the `Remove` button when count drops to this. */
  minItems?: number;
}

export interface ObjectListField {
  key: string;
  kind: "list-object";
  label: string;
  itemLabel: string;
  tooltip: string;
  /** Sub-fields for each item. Each `ScalarField.key` is RELATIVE — just the
   *  field name, no dot path (e.g. "name", not "archetypes[].name"). */
  fields: ReadonlyArray<ScalarField>;
}

export type AnyField = ScalarField | StringListField | ObjectListField;

export interface SchemaSection {
  /** Top-level YAML key the section's fields live under. */
  key: string;
  label: string;
  description: string;
  fields: ReadonlyArray<AnyField>;
}

export type Schema = ReadonlyArray<SchemaSection>;
