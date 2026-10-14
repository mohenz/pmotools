// [WBS2 복사본] 원본: app/requirements/statistics/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getLocalContext } from "@/lib/server/mp/context";
import { getRequirementStatistics } from "@/lib/server/mp/requirements";
import { RequirementStatisticsScreen } from "@/screens/mp/RequirementStatisticsScreen";

export const dynamic = "force-dynamic";

export default async function RequirementStatisticsPage() {
  const { projectId } = await getLocalContext();
  return <RequirementStatisticsScreen statistics={await getRequirementStatistics(projectId)} />;
}
