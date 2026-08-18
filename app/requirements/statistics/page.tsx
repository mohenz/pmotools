import { getLocalContext } from "@/lib/server/context";
import { getRequirementStatistics } from "@/lib/server/requirements";
import { RequirementStatisticsScreen } from "@/screens/RequirementStatisticsScreen";

export const dynamic = "force-dynamic";

export default async function RequirementStatisticsPage() {
  const { projectId } = await getLocalContext();
  return <RequirementStatisticsScreen statistics={await getRequirementStatistics(projectId)} />;
}
