import { requireManagerContext } from "@/lib/server/context";
import { getWbsWorkload } from "@/lib/server/wbs";
import { WbsAnalysisDashboardScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

export default async function WbsAnalysisDashboardPage() {
  const { projectId } = await requireManagerContext();
  const analysis = await getWbsWorkload(projectId);
  return <WbsAnalysisDashboardScreen analysis={analysis} basePath="/wbs" />;
}
