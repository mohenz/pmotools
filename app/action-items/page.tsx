import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectActionItems } from "@/lib/server/action-items";
import { listProjectMembers } from "@/lib/server/users";
import { ActionItemListScreen } from "@/screens/ActionItemListScreen";

export const dynamic = "force-dynamic";

export default async function ActionItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    q: typeof params.q === "string" ? params.q : "",
    status: typeof params.status === "string" ? params.status : "",
    groupId: typeof params.groupId === "string" ? params.groupId : "",
    assigneeId: typeof params.assigneeId === "string" ? params.assigneeId : "",
    page: typeof params.page === "string" ? Number(params.page) || 1 : 1,
  };
  const { projectId } = await requirePmPmoContext();
  const [result, options, members] = await Promise.all([listProjectActionItems(projectId, filters), getCodeOptions(projectId), listProjectMembers(projectId)]);
  return <ActionItemListScreen result={result} filters={filters} groups={options.tracks} members={members} />;
}
