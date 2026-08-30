import { getLocalContext } from "@/lib/server/context";
import { getWbsWeeklyStats } from "@/lib/server/wbs";
import { WbsWeeklyStatsScreen } from "@/screens/WbsWeeklyStatsScreen";

export const dynamic = "force-dynamic";

export default async function WbsWeeklyStatsPage() {
  const { projectId } = await getLocalContext();
  const stats = await getWbsWeeklyStats(projectId);
  return <WbsWeeklyStatsScreen stats={stats} />;
}
