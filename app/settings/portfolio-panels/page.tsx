import { requireManagerContext } from "@/lib/server/context";
import { listPortfolioPanelPreferences } from "@/lib/server/portfolio-panels";
import { PortfolioPanelPreferencesScreen } from "@/features/settings/PortfolioPanelPreferencesScreen";

export const dynamic = "force-dynamic";

export default async function PortfolioPanelPreferencesPage() {
  const { projectId } = await requireManagerContext();
  const items = await listPortfolioPanelPreferences(projectId);
  return <PortfolioPanelPreferencesScreen initial={items} />;
}
