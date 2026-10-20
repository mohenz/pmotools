import { getMpScope } from "@/lib/server/mp/context";
import { getUtFormOptions, getUtScenarioDetail } from "@/lib/server/mp/ut/scenarios";
import { UtScenarioDetailScreen } from "@/screens/mp/ut/UtScenarioDetailScreen";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtScenarioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await getMpScope();
  const c = scope.context;
  const detail = await getUtScenarioDetail(scope.projectIds, id, { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle });
  const options = await getUtFormOptions(detail.projectId);
  return <UtScenarioDetailScreen detail={detail} options={options} userId={c.userId} />;
}
