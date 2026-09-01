import { requireManagerContext } from "@/lib/server/context";
import { getWbsStats, getWbsOwnerStatus } from "@/lib/server/wbs";
import { getRequirementStatistics } from "@/lib/server/requirements";
import { PortfolioScreen } from "@/screens/PortfolioScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { loginId, projectId } = await requireManagerContext();
  const [wbsStats, requirementStats, myWbsStatus] = await Promise.all([
    getWbsStats(projectId),
    getRequirementStatistics(projectId),
    getWbsOwnerStatus(projectId, loginId),
  ]);
  return <PortfolioScreen wbsStats={wbsStats} requirementStats={requirementStats} myWbsStatus={myWbsStatus} />;
}
