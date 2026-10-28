import { requireManagerContext } from "@/lib/server/context";
import { getWbsDelayedTaskStats } from "@/lib/server/wbs";
import { WbsDelayHistoryStatsScreen } from "@/screens/WbsDelayHistoryStatsScreen";

export const dynamic = "force-dynamic";

export default async function WbsDelayHistoryStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { projectId } = await requireManagerContext();
  const q = await searchParams;
  const filters = { from: q.from, to: q.to };
  const stats = await getWbsDelayedTaskStats(projectId, filters);
  return <WbsDelayHistoryStatsScreen stats={stats} filters={filters} isMp={false} />;
}
