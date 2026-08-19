import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listManagementTasks } from "@/lib/server/management-tasks";
import { ManagementTaskListScreen } from "@/screens/ManagementTaskListScreen";

export const dynamic = "force-dynamic";

export default async function ManagementTasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    q: typeof params.q === "string" ? params.q : "",
    groupId: typeof params.groupId === "string" ? params.groupId : "",
    band: typeof params.band === "string" ? params.band : "",
    page: typeof params.page === "string" ? Number(params.page) || 1 : 1,
  };
  const { projectId } = await requirePmPmoContext();
  const [result, options] = await Promise.all([listManagementTasks(projectId, filters), getCodeOptions(projectId)]);
  return <ManagementTaskListScreen result={result} filters={filters} groups={options.tracks} />;
}
