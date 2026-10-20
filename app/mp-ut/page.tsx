import { getMpScope } from "@/lib/server/mp/context";
import { getUtFormOptions, listUtScenarios } from "@/lib/server/mp/ut/scenarios";
import { UtScenarioListScreen } from "@/screens/mp/ut/UtScenarioListScreen";
import { paginate, parsePaging } from "@/features/mp/ut/UtPagination";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtScenarioListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const filters = { q: pick("q"), status: pick("status"), groupId: pick("groupId"), mine: pick("mine") };
  const scope = await getMpScope();
  const { page, pageSize } = parsePaging(params);
  const [all, options] = await Promise.all([
    listUtScenarios(scope.projectIds, { ...filters, userId: scope.context.userId }),
    getUtFormOptions(scope.context.projectId),
  ]);
  const result = paginate(all, page, pageSize);
  return <UtScenarioListScreen rows={result.rows} filters={filters} paging={{ pageSize, page: result.page, total: result.total, totalPages: result.totalPages }} groups={options.groups} canCreate={!scope.isTopLevel} />;
}
