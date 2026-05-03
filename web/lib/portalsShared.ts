// Client-safe types + helpers shared between server portals.ts and React components.
// Must NOT import any node:* modules.

export interface PortalCompany {
  slug: string;
  name: string;
  careersUrl: string;
  enabled: boolean;
  priority: boolean;
  notes: string | null;
  apiType: "Greenhouse" | "Ashby" | "Lever" | null;
  matchable: boolean;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
