// [WBS2 복사본] 원본: app/requirements/[id]/changes/new/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound, redirect } from "next/navigation";
import { getMpItemContext } from "@/lib/server/mp/context";
import { getRequirementDetail } from "@/lib/server/mp/requirements";
import { RequirementChangeCreateScreen } from "@/screens/mp/RequirementChangeCreateScreen";

export const dynamic = "force-dynamic";

export default async function RequirementChangeNewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 최상위 통합 조회에서 연 하위 프로젝트 요구사항이면 그 프로젝트 기준으로 권한을 본다(원본 requireManagerContext와 같은 규칙).
  const { projectId, role } = await getMpItemContext("requirement", id);
  if (role !== "ADMIN" && role !== "OPERATOR" && role !== "SUPER_ADMIN") redirect("/calendar");
  const detail = await getRequirementDetail(projectId, id);
  if (!detail) notFound();
  return <RequirementChangeCreateScreen requirement={detail.requirement} />;
}
