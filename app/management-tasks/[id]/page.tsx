import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getManagementTaskDetail } from "@/lib/server/management-tasks";
import { listActionItemCategoryOptions, listManagementTaskActionItems } from "@/lib/server/action-items";
import { getCodeOptions } from "@/lib/server/common-codes";
import { listProjectMembers } from "@/lib/server/users";
import { ManagementTaskDetailScreen } from "@/screens/ManagementTaskDetailScreen";

export const dynamic = "force-dynamic";

export default async function ManagementTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await getLocalContext();
  const detail = await getManagementTaskDetail(projectId, id);
  if (!detail) notFound();
  const [axes, options, members, categories] = await Promise.all([
    listManagementTaskActionItems(projectId, id),
    getCodeOptions(projectId),
    listProjectMembers(projectId),
    listActionItemCategoryOptions(projectId),
  ]);
  if (!axes) notFound();
  return <ManagementTaskDetailScreen detail={detail} axes={axes} groups={options.tracks} members={members} categories={categories} />;
}
