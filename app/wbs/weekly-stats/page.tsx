import { getLocalContext } from "@/lib/server/context";
import { defaultWbsWeeklyRange, getWbsWeeklyStats } from "@/lib/server/wbs";
import { WbsWeeklyStatsScreen } from "@/screens/WbsWeeklyStatsScreen";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function WbsWeeklyStatsPage({ searchParams }: { searchParams: Promise<{ startDate?: string; endDate?: string }> }) {
  const query = await searchParams;
  const { projectId } = await getLocalContext();
  const defaults = defaultWbsWeeklyRange();
  const startDate = query.startDate && DATE_RE.test(query.startDate) ? query.startDate : defaults.startDate;
  const endDate = query.endDate && DATE_RE.test(query.endDate) ? query.endDate : defaults.endDate;
  const [rangeStart, rangeEnd] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const stats = await getWbsWeeklyStats(projectId, rangeStart, rangeEnd);
  return <WbsWeeklyStatsScreen stats={stats} />;
}
