import { getMpScope } from "@/lib/server/mp/context";
import { getPrisma } from "@/lib/server/db-pg";
import { getUtCaseEditor, getUtWbsTree } from "@/lib/server/mp/ut/grid";
import { getUtFormOptions } from "@/lib/server/mp/ut/cases";
import { UtCaseScreen } from "@/screens/mp/ut/UtCaseScreen";

export const dynamic = "force-dynamic";

// 단위테스트(설계서 8장 화면 ID 기준) — 다중 프로젝트(MP) 계열, 좌측 WBS 트리 고정.
// 단위테스트 정보확인/처리(신규 등록)
export default async function UtCaseNewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context; const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  const [editor, options, tree, project] = await Promise.all([
    getUtCaseEditor(c.projectId, actor, { wbs: pick("wbs") || undefined }),
    getUtFormOptions(c.projectId), getUtWbsTree(c.projectId), getPrisma().project.findUnique({ where: { id: c.projectId }, select: { code: true } }),
  ]);
  return <UtCaseScreen editor={editor} options={options} leaves={tree.filter((n) => n.isLeaf)} projectCode={project?.code ?? ""} userId={c.userId} />;
}
