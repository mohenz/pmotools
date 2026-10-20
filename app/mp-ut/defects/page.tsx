import { getMpScope } from "@/lib/server/mp/context";
import { listUtRunRows } from "@/lib/server/mp/ut/defects";
import { getUtWbsTree } from "@/lib/server/mp/ut/grid";
import { getUtFormOptions } from "@/lib/server/mp/ut/scenarios";
import { listWbsItems } from "@/lib/server/mp/wbs";
import { UtDefectsScreen } from "@/screens/mp/ut/UtDefectsScreen";
import { paginate, parsePaging } from "@/features/mp/ut/UtPagination";

export const dynamic = "force-dynamic";

// 단위테스트(설계서 8장 화면 ID 기준) — 다중 프로젝트(MP) 계열, 좌측 WBS 트리 고정.
// UT-040 결함 관리
export default async function UtDefectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const filters = { wbs: pick("wbs"), q: pick("q"), defect: pick("defect") };
  const { page, pageSize } = parsePaging(params);
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context; const actor = { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle };
  const [tree, rowsAll, options, items] = await Promise.all([
    getUtWbsTree(c.projectId),
    listUtRunRows([c.projectId], actor, { q: filters.q || undefined, defectOnly: filters.defect === "any", openOnly: filters.defect === "open" }),
    getUtFormOptions(c.projectId), filters.wbs ? listWbsItems(c.projectId) : Promise.resolve([]),
  ]);
  let rows = rowsAll;
  if (filters.wbs) {
    const node = items.find((i) => i.id === filters.wbs);
    const ids = new Set(items.filter((i) => node && (i.path === node.path || i.path.startsWith(`${node.path}.`))).map((i) => i.id));
    rows = rowsAll.filter((r) => ids.has(r.wbsItemId));
  }
  const result = paginate(rows, page, pageSize);
  return <UtDefectsScreen tree={tree} rows={result.rows} filters={filters} paging={{ pageSize, page: result.page, total: result.total, totalPages: result.totalPages }} options={options} />;
}
