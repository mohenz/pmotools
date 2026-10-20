import { getMpScope } from "@/lib/server/mp/context";
import { getPrisma } from "@/lib/server/db-pg";
import { getUtCaseEditor } from "@/lib/server/mp/ut/grid";
import { getUtFormOptions } from "@/lib/server/mp/ut/scenarios";
import { UtCaseEditScreen } from "@/screens/mp/ut/UtCaseEditScreen";

export const dynamic = "force-dynamic";

// 단위테스트(설계서 8장 화면 ID 기준) — 다중 프로젝트(MP) 계열, 좌측 WBS 트리 고정.
// UT-021 케이스 편집
export default async function UtCaseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context; const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  const [editor, options, project] = await Promise.all([getUtCaseEditor(c.projectId, actor, { caseId: id }), getUtFormOptions(c.projectId), getPrisma().project.findUnique({ where: { id: c.projectId }, select: { code: true } })]);
  return <UtCaseEditScreen editor={editor} options={options} leaves={[]} projectCode={project?.code ?? ""} userId={c.userId} />;
}
