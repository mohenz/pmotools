import { getLocalContext } from "@/lib/server/context";
import { getWbsGroupTasks } from "@/lib/server/wbs";
import { WbsGroupTasksScreen } from "@/screens/WbsGroupTasksScreen";

export const dynamic = "force-dynamic";

export default async function WbsGroupTasksPage({ searchParams }: { searchParams: Promise<{ group?: string; delayed?: string }> }) {
  const { projectId } = await getLocalContext();
  const params = await searchParams;
  const tasks = await getWbsGroupTasks(projectId, params.group ?? "", params.delayed === "1");
  return <WbsGroupTasksScreen tasks={tasks} />;
}
