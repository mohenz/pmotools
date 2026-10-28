import { getMpScope } from "@/lib/server/mp/context";
import { getWbsDelayedTaskStats } from "@/lib/server/mp/wbs";
import { WbsDelayHistoryStatsScreen } from "@/screens/mp/WbsDelayHistoryStatsScreen";

export const dynamic = "force-dynamic";

export default async function MpWbsDelayHistoryStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const scope = await getMpScope();
  const q = await searchParams;
  const filters = { from: q.from, to: q.to };
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const stats = await getWbsDelayedTaskStats(targetId, filters);
  return <WbsDelayHistoryStatsScreen stats={stats} filters={filters} isMp />;
}
