"use client";
// Thin wrapper around the generic YamlEditor for the `profile` tab. Lets the
// dispatch in ProfileView stay readable while the actual logic lives in
// YamlEditor + YamlSchemaForm.
import type { UserFileMeta } from "./ProfileView";
import { YamlEditor } from "./YamlEditor";
import { PROFILE_SCHEMA } from "@/lib/data/profileSchema";

interface Props {
  fileKey: string;
  meta: UserFileMeta;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function ProfileEditor(props: Props) {
  return (
    <YamlEditor
      {...props}
      schema={PROFILE_SCHEMA}
      anchorPrefix="profile"
      navLabel="Profile sections"
    />
  );
}
