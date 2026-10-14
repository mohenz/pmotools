// [WBS2 복사본] 원본: app/wbs/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { canViewAllWbs } from "@/lib/domain/job-access";
import { getMpScope } from "@/lib/server/mp/context";
import { getCriticalPathMinWorkingDays, listWbsItemsExcelColumns } from "@/lib/server/mp/wbs";
import { WbsListScreen } from "@/screens/mp/WbsListScreen";

export const dynamic = "force-dynamic";

export default async function WbsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // 최상위 프로젝트를 고르면 하위 프로젝트 WBS까지 합쳐 보여준다(2026-09-30) — 권한 규칙은 계정 역할 기준이라 선택 프로젝트 역할을 그대로 쓴다.
  const scope = await getMpScope(), { projectId, userId, role } = scope.context, p = await searchParams;
  const value = (key: string) => typeof p[key] === "string" ? p[key] as string : "";
  const pageSize = value("pageSize") === "all" ? "all" as const : [50, 100, 200].includes(Number(value("pageSize"))) ? Number(value("pageSize")) : 50;
  const statusValues = ["not_started", "in_progress", "completed", "on_hold"];
  const rawExclude = p["excludeCompleted"];
  const excludeCompleted = rawExclude === undefined
    ? true
    : Array.isArray(rawExclude)
      ? rawExclude.includes("y") || rawExclude.includes("true")
      : rawExclude === "y" || rawExclude === "true";
  const cpMinWorkingDays = await getCriticalPathMinWorkingDays(projectId);
  const filters = {
    page: Number(value("page")) || 1, pageSize, q: value("q"), assignee: value("assignee"),
    startDateFrom: value("startDateFrom"), startDateTo: value("startDateTo"),
    dueDateFrom: value("dueDateFrom"), dueDateTo: value("dueDateTo"),
    actualStartDateFrom: value("actualStartDateFrom"), actualStartDateTo: value("actualStartDateTo"),
    actualDueDateFrom: value("actualDueDateFrom"), actualDueDateTo: value("actualDueDateTo"),
    delayed: (value("delayed") === "y" || value("delayed") === "n" ? value("delayed") : "") as "" | "y" | "n",
    stage: value("stage"),
    status: (statusValues.includes(value("status")) ? value("status") : "") as "" | "not_started" | "in_progress" | "completed" | "on_hold",
    excludeCompleted,
    cp: value("cp") === "y", cpMinWorkingDays,
    projectCode: scope.isTopLevel ? value("projectCode") : "",
    ...(canViewAllWbs(role) ? {} : { ownerUserId: userId }),
  };
  const result = await listWbsItemsExcelColumns(scope.projectIds, filters);
  return <WbsListScreen result={result} filters={filters} topLevel={scope.isTopLevel ? { projects: scope.projects.map(({ code, name }) => ({ code, name })) } : undefined} />;
}
