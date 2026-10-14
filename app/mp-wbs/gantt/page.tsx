import { canViewAllWbs } from "@/lib/domain/job-access";
import { buildGanttRows, groupGanttSourcesByProject, type GanttFilters } from "@/lib/domain/mp/gantt";
import { getMpScope } from "@/lib/server/mp/context";
import { getAllWbsExcelRows, getCriticalPathMinWorkingDays, loadHolidaySet } from "@/lib/server/mp/wbs";
import { WbsGanttScreen } from "@/screens/mp/WbsGanttScreen";

export const dynamic = "force-dynamic";

const kstToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

// WBS2 간트 차트(조회 전용) — 선택 프로젝트의 캐시된 WBS 행을 그대로 쓰며 DB 추가 조회는 휴일·CP 기준값뿐이다.
// 권한은 WBS2 목록과 같다: 일반 사용자는 본인 담당 Task(와 그 상위 단계)만.
export default async function WbsGanttPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const scope = await getMpScope(), { projectId, userId, role } = scope.context, p = await searchParams;
  const value = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
  // 최상위 프로젝트를 고르면 하위 프로젝트까지 프로젝트 단위 요약 행으로 묶어 한 간트에 그린다(2026-09-30). 휴일·CP 기준은 선택 프로젝트 값.
  const [groups, holidays, cpMinWorkingDays] = await Promise.all([
    Promise.all(scope.projects.map(async (project) => ({ ...project, items: await getAllWbsExcelRows(project.id) }))),
    loadHolidaySet(projectId), getCriticalPathMinWorkingDays(projectId),
  ]);
  const items = scope.isTopLevel ? groupGanttSourcesByProject(groups) : groups[0]?.items ?? await getAllWbsExcelRows(projectId);
  const filters: GanttFilters = {
    q: value("q"), assignee: value("assignee"), stage: value("stage"),
    delayed: value("delayed") === "y", cp: value("cp") === "y", cpMinWorkingDays, excludeCompleted: value("excludeCompleted") === "y",
    ...(canViewAllWbs(role) ? {} : { ownerUserId: userId }),
  };
  const rows = buildGanttRows(items, filters);
  const stages = Array.from(new Set(items.map((item) => item.stage).filter((stage): stage is string => Boolean(stage))));
  return <WbsGanttScreen rows={rows} holidays={[...holidays]} today={kstToday()} stages={stages} cpMinWorkingDays={cpMinWorkingDays}
    filters={{ q: filters.q ?? "", assignee: filters.assignee ?? "", stage: filters.stage ?? "", delayed: Boolean(filters.delayed), cp: Boolean(filters.cp), excludeCompleted: Boolean(filters.excludeCompleted) }}
    restricted={!canViewAllWbs(role)} projectCount={scope.isTopLevel ? scope.projects.length : 0} />;
}
