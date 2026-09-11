import { notFound, redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getWorkLogDetail } from "@/lib/server/work-logs";
import { listWbsTaskOptionsForOwner } from "@/lib/server/wbs";
import { WorkLogFormScreen } from "@/screens/WorkLogFormScreen";

export const dynamic = "force-dynamic";

export default async function EditWorkLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext(), { id } = await params;
  const [detail, options, wbsOptions] = await Promise.all([getWorkLogDetail(projectId, id, userId), getCodeOptions(projectId), listWbsTaskOptionsForOwner(projectId, userId)]);
  if (!detail) notFound();
  if (!detail.editable) redirect(`/work-logs/${id}`);
  return <WorkLogFormScreen mode="edit" groups={options.tracks} assigneeName={detail.assigneeName} detail={detail} wbsOptions={wbsOptions} />;
}
