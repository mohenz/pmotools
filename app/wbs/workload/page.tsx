import { requireManagerContext } from "@/lib/server/context";
import { getWbsWorkload } from "@/lib/server/wbs";
import { WbsWorkloadScreen } from "@/screens/WbsAnalysisScreens";

export const dynamic = "force-dynamic";

export default async function WbsWorkloadPage() {
  const { projectId } = await requireManagerContext();
  const analysis = await getWbsWorkload(projectId);
  return <WbsWorkloadScreen analysis={analysis} />;
}
