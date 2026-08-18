import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getManagementTaskDetail } from "@/lib/server/management-tasks";
import { ManagementTaskDetailScreen } from "@/screens/ManagementTaskDetailScreen";

export const dynamic = "force-dynamic";

export default async function ManagementTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await getLocalContext();
  const [detail, options] = await Promise.all([getManagementTaskDetail(projectId, id), getCodeOptions(projectId)]);
  if (!detail) notFound();
  return <ManagementTaskDetailScreen detail={detail} groups={options.tracks} />;
}
