import { getMpScope } from "@/lib/server/mp/context";
import { getUtWbsTree, listUtCaseGrid } from "@/lib/server/mp/ut/grid";
import { UtCaseListScreen } from "@/screens/mp/ut/UtCaseListScreen";
import { paginate, parsePaging } from "@/features/mp/ut/UtPagination";

export const dynamic = "force-dynamic";

// 단위테스트(설계서 8장 화면 ID 기준) — 다중 프로젝트(MP) 계열, 좌측 WBS 트리 고정.
// UT-020 시나리오·케이스 목록
export default async function UtCaseListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const filters = { wbs: pick("wbs"), q: pick("q"), status: pick("status"), caseType: pick("caseType"), priority: pick("priority") };
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const { page, pageSize } = parsePaging(params);
  const [tree, all] = await Promise.all([getUtWbsTree(scope.context.projectId), listUtCaseGrid(scope.context.projectId, { ...filters, wbs: filters.wbs || undefined })]);
  const result = paginate(all, page, pageSize);
  return <UtCaseListScreen tree={tree} rows={result.rows} filters={filters} paging={{ pageSize, page: result.page, total: result.total, totalPages: result.totalPages }} canCreate />;
}
