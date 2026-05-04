"use client";
// Thin wrapper around the generic YamlSchemaForm. Keeps the call site stable
// for ProfileEditor while the actual rendering lives in YamlSchemaForm.
import { PROFILE_SCHEMA } from "@/lib/data/profileSchema";
import { YamlSchemaForm } from "./YamlSchemaForm";

interface Props {
  content: string;
  onChange: (next: string) => void;
}

export function ProfileForm({ content, onChange }: Props) {
  return (
    <YamlSchemaForm
      schema={PROFILE_SCHEMA}
      content={content}
      onChange={onChange}
      anchorPrefix="profile"
      navLabel="Profile sections"
    />
  );
}
