import { requireManagerContext } from "@/lib/server/context";
import { getWbsStats, getWbsOwnerStatus } from "@/lib/server/wbs";
import { listPortfolioPanelPreferences } from "@/lib/server/portfolio-panels";
import { PortfolioScreen } from "@/screens/PortfolioScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { loginId, projectId } = await requireManagerContext();
  const [wbsStats, myWbsStatus, panelPrefs] = await Promise.all([
    getWbsStats(projectId),
    getWbsOwnerStatus(projectId, loginId),
    listPortfolioPanelPreferences(projectId),
  ]);
  return <PortfolioScreen wbsStats={wbsStats} myWbsStatus={myWbsStatus} panelPrefs={panelPrefs} />;
}
