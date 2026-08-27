import { notFound } from "next/navigation";
import { requirePmPmoContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getManagementTaskDetail } from "@/lib/server/management-tasks";
import { listProjectMembers } from "@/lib/server/users";
import { ManagementTaskEditScreen } from "@/screens/ManagementTaskEditScreen";

export const dynamic = "force-dynamic";

export default async function ManagementTaskEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await requirePmPmoContext();
  const [detail, options, members] = await Promise.all([getManagementTaskDetail(projectId, id), getCodeOptions(projectId), listProjectMembers(projectId)]);
  if (!detail) notFound();
  return <ManagementTaskEditScreen detail={detail} groups={options.tracks} members={members} />;
}
