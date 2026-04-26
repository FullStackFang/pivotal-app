import { listApplications } from "@/lib/data/sqlite";
import { PipelineView } from "@/components/PipelineView";

export default async function PipelinePage() {
  const apps = listApplications({});
  return <PipelineView initialApplications={apps} />;
}
