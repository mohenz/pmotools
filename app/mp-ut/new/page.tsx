import { getMpScope } from "@/lib/server/mp/context";
import { getPlReference, getUtFormOptions, listUtWbsLeaves } from "@/lib/server/mp/ut/scenarios";
import { UtScenarioCreateScreen } from "@/screens/mp/ut/UtScenarioCreateScreen";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtScenarioCreatePage() {
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">최상위(대표) 프로젝트에서는 등록할 수 없습니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const { projectId, userId } = scope.context;
  const [options, leaves, plReference] = await Promise.all([getUtFormOptions(projectId), listUtWbsLeaves(projectId), getPlReference(projectId, userId)]);
  return <UtScenarioCreateScreen options={options} leaves={leaves} plReference={plReference} userId={userId} />;
}
