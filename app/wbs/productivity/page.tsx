import { requireManagerContext } from "@/lib/server/context";
import { getWbsWorkload } from "@/lib/server/wbs";
import { WbsProductivityScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

export default async function WbsProductivityPage() {
  const { projectId } = await requireManagerContext();
  const analysis = await getWbsWorkload(projectId);
  return <WbsProductivityScreen analysis={analysis} />;
}
