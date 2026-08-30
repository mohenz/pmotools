import { requireManagerContext } from "@/lib/server/context";
import { getPortfolioDashboard, listWeeklyProgress } from "@/lib/server/work-management";
import { getWbsStats } from "@/lib/server/wbs";
import { getRequirementStatistics } from "@/lib/server/requirements";
import { getManagementTaskDashboard } from "@/lib/server/management-tasks";
import { PortfolioScreen } from "@/screens/PortfolioScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { projectId } = await requireManagerContext();
  const [dashboard, rows, wbsStats, requirementStats, managementDashboard] = await Promise.all([
    getPortfolioDashboard(projectId),
    listWeeklyProgress(projectId),
    getWbsStats(projectId),
    getRequirementStatistics(projectId),
    getManagementTaskDashboard(projectId),
  ]);
  return <PortfolioScreen dashboard={dashboard} rows={rows} wbsStats={wbsStats} requirementStats={requirementStats} managementDashboard={managementDashboard} />;
}
