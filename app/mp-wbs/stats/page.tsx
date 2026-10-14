// [WBS2 복사본] 원본: app/wbs/stats/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getMpScope } from "@/lib/server/mp/context";
import { getWbsStats } from "@/lib/server/mp/wbs";
import { WbsStatsScreen } from "@/screens/mp/WbsStatsScreen";

export const dynamic = "force-dynamic";

export default async function WbsStatsPage() {
  const scope = await getMpScope();
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const stats = await getWbsStats(targetId);
  return <WbsStatsScreen stats={stats} />;
}
