// [WBS2 복사본] 원본: app/requirements/[id]/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound } from "next/navigation";
import { getMpItemContext } from "@/lib/server/mp/context";
import { getRequirementDetail, listRequirementCodeOptions } from "@/lib/server/mp/requirements";
import { listProjectMembers } from "@/lib/server/users";
import { RequirementDetailScreen } from "@/screens/mp/RequirementDetailScreen";

export const dynamic = "force-dynamic";

export default async function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, role } = await getMpItemContext("requirement", id);
  const [detail, members, codeOptions] = await Promise.all([getRequirementDetail(projectId, id), listProjectMembers(projectId), listRequirementCodeOptions(projectId)]);
  if (!detail) notFound();
  return <RequirementDetailScreen detail={detail} options={{ members, ...codeOptions }} isManager={role === "ADMIN" || role === "OPERATOR" || role === "SUPER_ADMIN"} />;
}
