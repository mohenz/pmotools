import { canViewAllWbs } from "@/lib/domain/job-access";
import { getLocalContext } from "@/lib/server/context";
import { getCriticalPathMinWorkingDays, listWbsItemsExcelColumns } from "@/lib/server/wbs";
import { WbsListScreen } from "@/screens/WbsListScreen";

export const dynamic = "force-dynamic";

export default async function WbsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, userId, role } = await getLocalContext(), p = await searchParams;
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
    ...(canViewAllWbs(role) ? {} : { ownerUserId: userId }),
  };
  const result = await listWbsItemsExcelColumns(projectId, filters);
  return <WbsListScreen result={result} filters={filters} />;
}
