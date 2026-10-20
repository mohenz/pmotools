import "server-only";
import { getPrisma } from "@/lib/server/db-pg";
import { listWbsItems } from "@/lib/server/wbs";
import { descendantsOf, topAncestorOf } from "@/lib/server/mp/context";
import { metricsOfLeaves, projectStatusOf, scheduleWarningOf, sumMetrics, type PortfolioMetrics, type PortfolioStatus } from "@/lib/domain/project-portfolio";

// ---------------------------------------------------------------------------
// 프로젝트 포트폴리오(PMO Daily 하위 탭) — 로그인 프로젝트가 속한 대표 프로젝트의 하위 프로젝트 전체(배정 여부 무관,
// 2026-10-20 D3)를 WBS 지표와 함께 반환한다. 접근 권한(PM/PMO)은 호출하는 페이지·API에서 검사한다.
// 지표는 WBS 통계와 같은 Leaf·가중치·지연 규칙(lib/domain/project-portfolio.ts)으로 계산하며 DB를 변경하지 않는다.
// ---------------------------------------------------------------------------

export type PortfolioProjectRow = {
  id: string;
  code: string;
  name: string;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  customerPm: string;
  vendorPm: string;
  startDate: string | null;
  endDate: string | null;
  /** 프로젝트 자신의 WBS 지표 */
  own: PortfolioMetrics;
  /** 자신 + 하위 프로젝트 전체 합산 지표(하위가 없으면 own과 같다) */
  rollup: PortfolioMetrics;
  status: PortfolioStatus;
  warning: string | null;
};

export type ProjectPortfolio = { rootId: string; rootName: string; asOf: string; rows: PortfolioProjectRow[]; total: PortfolioMetrics };

const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

function koreaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function metricsOfProject(projectId: string, today: string) {
  const items = await listWbsItems(projectId); // 보관 제외, 프로세스 메모리 캐시(getAllWbsExcelRows)
  const parentIds = new Set(items.filter((item) => item.parentId).map((item) => item.parentId!));
  return metricsOfLeaves(items.filter((item) => !parentIds.has(item.id)), today);
}

export async function getProjectPortfolio(loginProjectId: string): Promise<ProjectPortfolio> {
  const projects = await getPrisma().project.findMany({
    select: { id: true, code: true, name: true, parentId: true, sortOrder: true, customerPm: true, vendorPm: true, startDate: true, endDate: true },
  });
  const byId = new Map(projects.map((project) => [project.id, project]));
  const rootId = topAncestorOf(loginProjectId, projects);
  const ordered = descendantsOf(rootId, projects);

  // 지연 판정 모수의 "오늘"은 WBS 통계(delayStatsOf)와 같은 UTC 날짜를 써서 두 화면 수치를 일치시킨다.
  const metricsToday = new Date().toISOString().slice(0, 10);
  const ownList = await Promise.all(ordered.map(({ project }) => metricsOfProject(project.id, metricsToday)));
  const ownById = new Map(ordered.map(({ project }, index) => [project.id, ownList[index]]));

  const childrenOf = new Map<string, string[]>();
  for (const { project } of ordered) {
    if (project.parentId && ownById.has(project.parentId)) childrenOf.set(project.parentId, [...(childrenOf.get(project.parentId) ?? []), project.id]);
  }
  const subtreeIds = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [id, ...(childrenOf.get(id) ?? []).flatMap((child) => subtreeIds(child, seen))];
  };

  const today = koreaToday();
  const rows = ordered.map(({ project, depth }) => {
    const source = byId.get(project.id)!;
    const own = ownById.get(project.id)!;
    const hasChildren = (childrenOf.get(project.id) ?? []).length > 0;
    const rollup = hasChildren ? sumMetrics(subtreeIds(project.id).map((id) => ownById.get(id)!)) : own;
    const status = projectStatusOf(rollup);
    const startDate = dateOnly(source.startDate);
    const endDate = dateOnly(source.endDate);
    return {
      id: project.id, code: project.code, name: project.name, depth, parentId: project.parentId, hasChildren,
      customerPm: source.customerPm, vendorPm: source.vendorPm, startDate, endDate,
      own, rollup, status, warning: scheduleWarningOf(status, startDate, endDate, today),
    } satisfies PortfolioProjectRow;
  });

  return { rootId, rootName: byId.get(rootId)?.name ?? "", asOf: new Date().toISOString(), rows, total: sumMetrics(ownList) };
}
