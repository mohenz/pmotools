import { requireManagerContext } from "@/lib/server/context";
import { getWbsStats, getWbsOwnerStatus } from "@/lib/server/wbs";
import { listPortfolioPanelPreferences } from "@/lib/server/portfolio-panels";
import { listReceivedInvitations } from "@/lib/server/messages";
import { PortfolioScreen } from "@/screens/PortfolioScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { userId, loginId, projectId } = await requireManagerContext();
  const [wbsStats, myWbsStatus, panelPrefs, invitations] = await Promise.all([
    getWbsStats(projectId),
    getWbsOwnerStatus(projectId, loginId),
    listPortfolioPanelPreferences(projectId),
    listReceivedInvitations(userId),
  ]);
  return <PortfolioScreen wbsStats={wbsStats} myWbsStatus={myWbsStatus} panelPrefs={panelPrefs} invitations={invitations} />;
}
