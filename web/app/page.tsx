import { listApplications } from "@/lib/data/sqlite";
import { PipelineView } from "@/components/PipelineView";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const apps = listApplications({});
  return <PipelineView initialApplications={apps} />;
}
