import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getRequirementDetail, listRequirementCodeOptions } from "@/lib/server/requirements";
import { listProjectMembers } from "@/lib/server/users";
import { RequirementDetailScreen } from "@/screens/RequirementDetailScreen";

export const dynamic = "force-dynamic";

export default async function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await getLocalContext();
  const [detail, members, codeOptions] = await Promise.all([getRequirementDetail(projectId, id), listProjectMembers(projectId), listRequirementCodeOptions(projectId)]);
  if (!detail) notFound();
  return <RequirementDetailScreen detail={detail} options={{ members, ...codeOptions }} />;
}
