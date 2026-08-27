import { notFound } from "next/navigation";
import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getManagementTaskDetail } from "@/lib/server/management-tasks";
import { ManagementTaskDetailScreen } from "@/screens/ManagementTaskDetailScreen";
import { listProjectMembers } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function ManagementTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await requirePmPmoContext();
  const [detail, options, members] = await Promise.all([getManagementTaskDetail(projectId, id), getCodeOptions(projectId), listProjectMembers(projectId)]);
  if (!detail) notFound();
  return <ManagementTaskDetailScreen detail={detail} groups={options.tracks} members={members} />;
}
