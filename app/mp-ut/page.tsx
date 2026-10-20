import { getMpScope } from "@/lib/server/mp/context";
import { getUtWbsTree, listUtCaseSheet } from "@/lib/server/mp/ut/grid";
import { UtListScreen } from "@/screens/mp/ut/UtListScreen";
import { paginate, parsePaging } from "@/features/mp/ut/UtPagination";

export const dynamic = "force-dynamic";

// 단위테스트 목록(2026-10-20 화면 2개 체계: 목록 + 정보확인/처리) — 사용자 양식 24개 열, WBS 단위테스트 대상 Task 기준 행(2026-10-21).
export default async function UtListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const filters = { wbs: pick("wbs"), q: pick("q"), verdict: pick("verdict"), todo: pick("todo") };
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const { page, pageSize } = parsePaging(params);
  const [tree, all] = await Promise.all([getUtWbsTree(c.projectId), listUtCaseSheet(c.projectId, { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle }, { wbs: filters.wbs || undefined, q: filters.q || undefined, verdict: filters.verdict || undefined, todo: filters.todo || undefined })]);
  const result = paginate(all, page, pageSize);
  return <UtListScreen tree={tree} rows={result.rows} filters={filters} paging={{ pageSize, page: result.page, total: result.total, totalPages: result.totalPages }} canCreate />;
}
