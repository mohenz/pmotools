import { notFound } from "next/navigation";
import { requirePmPmoContext } from "@/lib/server/context";
import { getManagementTaskDetail } from "@/lib/server/management-tasks";
import { ManagementTaskDetailScreen } from "@/screens/ManagementTaskDetailScreen";

export const dynamic = "force-dynamic";

export default async function ManagementTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await requirePmPmoContext();
  const detail = await getManagementTaskDetail(projectId, id);
  if (!detail) notFound();
  return <ManagementTaskDetailScreen detail={detail} />;
}
