import { requireManagerContext } from "@/lib/server/context";
import { getWbsGroupTasks } from "@/lib/server/wbs";
import { WbsGroupTasksScreen } from "@/screens/WbsGroupTasksScreen";

export const dynamic = "force-dynamic";

export default async function WbsGroupTasksPage({ searchParams }: { searchParams: Promise<{ group?: string; delayed?: string; startDate?: string; endDate?: string }> }) {
  const { projectId } = await requireManagerContext();
  const params = await searchParams;
  const weekRange = params.startDate && params.endDate ? { startDate: params.startDate, endDate: params.endDate } : undefined;
  const tasks = await getWbsGroupTasks(projectId, params.group ?? "", params.delayed === "1", weekRange);
  return <WbsGroupTasksScreen tasks={tasks} />;
}
