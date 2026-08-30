import { requireManagerContext } from "@/lib/server/context";
import { getPortfolioDashboard } from "@/lib/server/work-management";
import { getWbsStats } from "@/lib/server/wbs";
import { getRequirementStatistics } from "@/lib/server/requirements";
import { getManagementTaskDashboard } from "@/lib/server/management-tasks";
import { listReceivedInvitations } from "@/lib/server/messages";
import { PortfolioScreen } from "@/screens/PortfolioScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { userId, projectId } = await requireManagerContext();
  const [dashboard, wbsStats, requirementStats, managementDashboard, invitations] = await Promise.all([
    getPortfolioDashboard(projectId),
    getWbsStats(projectId),
    getRequirementStatistics(projectId),
    getManagementTaskDashboard(projectId),
    listReceivedInvitations(userId),
  ]);
  return <PortfolioScreen dashboard={dashboard} wbsStats={wbsStats} requirementStats={requirementStats} managementDashboard={managementDashboard} invitations={invitations} />;
}
