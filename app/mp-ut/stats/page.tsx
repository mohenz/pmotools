import { getMpScope } from "@/lib/server/mp/context";
import { getUtStats } from "@/lib/server/mp/ut/stats";
import { UtStatsScreen } from "@/screens/mp/ut/UtStatsScreen";

export const dynamic = "force-dynamic";

// 단위테스트 작성현황·수행결과 통계(초안, 2026-10-23) — 다중 프로젝트(MP) 계열, 하위 프로젝트 단위.
export default async function UtStatsPage() {
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트 통계는 하위 프로젝트 단위로 봅니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  return <UtStatsScreen stats={await getUtStats(c.projectId)} />;
}
