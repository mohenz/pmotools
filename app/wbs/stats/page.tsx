import { getLocalContext } from "@/lib/server/context";
import { getWbsStats } from "@/lib/server/wbs";
import { WbsStatsScreen } from "@/screens/WbsStatsScreen";

export const dynamic = "force-dynamic";

export default async function WbsStatsPage() {
  const { projectId } = await getLocalContext();
  const stats = await getWbsStats(projectId);
  return <WbsStatsScreen stats={stats} />;
}
