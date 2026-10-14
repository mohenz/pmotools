// [WBS2 복사본] 원본: app/work-logs/[id]/edit/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound, redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/mp/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getWorkLogDetail } from "@/lib/server/mp/work-logs";
import { listWbsTaskOptionsForOwner } from "@/lib/server/mp/wbs";
import { WorkLogFormScreen } from "@/screens/mp/WorkLogFormScreen";

export const dynamic = "force-dynamic";

export default async function EditWorkLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext(), { id } = await params;
  const [detail, options, wbsOptions] = await Promise.all([getWorkLogDetail(projectId, id, userId), getCodeOptions(projectId), listWbsTaskOptionsForOwner(projectId, userId)]);
  if (!detail) notFound();
  if (!detail.editable) redirect(`/mp-work-logs/${id}`);
  return <WorkLogFormScreen mode="edit" groups={options.tracks} deliverableExtensions={options.deliverableExtensions} assigneeName={detail.assigneeName} detail={detail} wbsOptions={wbsOptions} />;
}
