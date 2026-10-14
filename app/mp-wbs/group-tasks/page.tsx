// [WBS2 복사본] 원본: app/wbs/group-tasks/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { requireManagerContext } from "@/lib/server/mp/context";
import { getWbsGroupTasks } from "@/lib/server/mp/wbs";
import { WbsGroupTasksScreen } from "@/screens/mp/WbsGroupTasksScreen";

export const dynamic = "force-dynamic";

export default async function WbsGroupTasksPage({ searchParams }: { searchParams: Promise<{ group?: string; delayed?: string; startDate?: string; endDate?: string }> }) {
  const { projectId } = await requireManagerContext();
  const params = await searchParams;
  const weekRange = params.startDate && params.endDate ? { startDate: params.startDate, endDate: params.endDate } : undefined;
  const tasks = await getWbsGroupTasks(projectId, params.group ?? "", params.delayed === "1", weekRange);
  return <WbsGroupTasksScreen tasks={tasks} />;
}
