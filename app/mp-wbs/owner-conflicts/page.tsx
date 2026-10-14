// [WBS2 복사본] 원본: app/wbs/owner-conflicts/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { requireManagerContext } from "@/lib/server/mp/context";
import { listAmbiguousWbsOwners } from "@/lib/server/mp/wbs";
import { WbsOwnerConflictsScreen } from "@/screens/mp/WbsOwnerConflictsScreen";

export const dynamic = "force-dynamic";

export default async function WbsOwnerConflictsPage() {
  const { projectId } = await requireManagerContext();
  const conflicts = await listAmbiguousWbsOwners(projectId);
  return <WbsOwnerConflictsScreen conflicts={conflicts} />;
}
