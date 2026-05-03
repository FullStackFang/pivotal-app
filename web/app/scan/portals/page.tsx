import { readPortals } from "@/lib/portals";
import { PortalsManager } from "@/components/PortalsManager";

export const dynamic = "force-dynamic";

export default function PortalsPage() {
  const { companies, fileExists } = readPortals();
  return <PortalsManager initialCompanies={companies} fileExists={fileExists} />;
}
