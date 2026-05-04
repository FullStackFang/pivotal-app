"use client";
// Editor for the `portals` tab. Wraps YamlEditor with PORTALS_SCHEMA.
import type { UserFileMeta } from "./ProfileView";
import { YamlEditor } from "./YamlEditor";
import { PORTALS_SCHEMA } from "@/lib/data/portalsSchema";

interface Props {
  fileKey: string;
  meta: UserFileMeta;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export function PortalsEditor(props: Props) {
  return (
    <YamlEditor
      {...props}
      schema={PORTALS_SCHEMA}
      anchorPrefix="portals"
      navLabel="Portals sections"
    />
  );
}
