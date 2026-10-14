// [WBS2 복사본] 원본: app/wbs/by-owner/[loginId]/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound } from "next/navigation";
import { canViewAllWbs } from "@/lib/domain/job-access";
import { getLocalContext } from "@/lib/server/mp/context";
import { getWbsOwnerStatus } from "@/lib/server/mp/wbs";
import { WbsOwnerStatusScreen } from "@/screens/mp/WbsOwnerStatusScreen";

export const dynamic = "force-dynamic";

export default async function WbsOwnerStatusPage({ params }: { params: Promise<{ loginId: string }> }) {
  const { loginId } = await params;
  const { projectId, loginId: ownLoginId, role } = await getLocalContext();
  if (!canViewAllWbs(role) && loginId !== ownLoginId) notFound();
  const status = await getWbsOwnerStatus(projectId, loginId);
  if (!status) notFound();
  return <WbsOwnerStatusScreen status={status} />;
}
