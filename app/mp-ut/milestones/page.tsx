import { getMpScope } from "@/lib/server/mp/context";
import { listUtMilestones } from "@/lib/server/mp/ut/milestones";
import { UtMilestonesScreen } from "@/screens/mp/ut/UtMilestonesScreen";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtMilestonesPage() {
  const scope = await getMpScope();
  const c = scope.context;
  if (scope.isTopLevel) return <div className="content"><p className="action-message">이정표는 하위 프로젝트 단위로 기록합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  return <UtMilestonesScreen rows={await listUtMilestones(c.projectId, { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle })} />;
}
