import { requireManagerContext } from "@/lib/server/context";
import { getPortfolioDashboard } from "@/lib/server/work-management";
import { getWbsStats, getWbsOwnerStatus } from "@/lib/server/wbs";
import { getRequirementStatistics } from "@/lib/server/requirements";
import { getManagementTaskDashboard } from "@/lib/server/management-tasks";
import { listReceivedInvitations } from "@/lib/server/messages";
import { PortfolioScreen } from "@/screens/PortfolioScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { userId, loginId, projectId } = await requireManagerContext();
  const [dashboard, wbsStats, requirementStats, managementDashboard, invitations, myWbsStatus] = await Promise.all([
    getPortfolioDashboard(projectId),
    getWbsStats(projectId),
    getRequirementStatistics(projectId),
    getManagementTaskDashboard(projectId),
    listReceivedInvitations(userId),
    getWbsOwnerStatus(projectId, loginId),
  ]);
  return <PortfolioScreen dashboard={dashboard} wbsStats={wbsStats} requirementStats={requirementStats} managementDashboard={managementDashboard} invitations={invitations} myWbsStatus={myWbsStatus} />;
}
