// [WBS2 복사본] 원본: app/wbs/weekly-stats/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getMpScope } from "@/lib/server/mp/context";
import { defaultWbsWeeklyRange, getWbsWeeklyStats } from "@/lib/server/mp/wbs";
import { WbsWeeklyStatsScreen } from "@/screens/mp/WbsWeeklyStatsScreen";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function WbsWeeklyStatsPage({ searchParams }: { searchParams: Promise<{ startDate?: string; endDate?: string }> }) {
  const query = await searchParams;
  const scope = await getMpScope();
  const defaults = defaultWbsWeeklyRange();
  const startDate = query.startDate && DATE_RE.test(query.startDate) ? query.startDate : defaults.startDate;
  const endDate = query.endDate && DATE_RE.test(query.endDate) ? query.endDate : defaults.endDate;
  const [rangeStart, rangeEnd] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const stats = await getWbsWeeklyStats(targetId, rangeStart, rangeEnd);
  return <WbsWeeklyStatsScreen stats={stats} />;
}
