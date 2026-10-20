import { getMpScope } from "@/lib/server/mp/context";
import { isUtManager } from "@/lib/server/mp/ut/common";
import { getUtSettings } from "@/lib/server/mp/ut/milestones";
import { UtSettingsScreen } from "@/screens/mp/ut/UtSettingsScreen";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtSettingsPage() {
  const scope = await getMpScope();
  const c = scope.context;
  const canManage = !scope.isTopLevel && isUtManager({ projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle });
  return <UtSettingsScreen settings={await getUtSettings(c.projectId)} canManage={canManage} />;
}
