import { getLocalContext } from "@/lib/server/context";
import { getWbsWorkGroupStats } from "@/lib/server/wbs";
import { WbsGroupStatsScreen } from "@/screens/WbsGroupStatsScreen";

export const dynamic = "force-dynamic";

export default async function WbsGroupStatsPage() {
  const { projectId } = await getLocalContext();
  const stats = await getWbsWorkGroupStats(projectId);
  return <WbsGroupStatsScreen stats={stats} />;
}
