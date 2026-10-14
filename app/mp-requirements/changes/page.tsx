// [WBS2 복사본] 원본: app/requirements/changes/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { requireManagerContext } from "@/lib/server/mp/context";
import { listRequirementChanges } from "@/lib/server/mp/requirements";
import { RequirementChangeListScreen } from "@/screens/mp/RequirementChangeListScreen";

export const dynamic = "force-dynamic";

export default async function RequirementChangesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    status: typeof params.status === "string" ? params.status : "",
    page: typeof params.page === "string" ? Number(params.page) || 1 : 1,
  };
  const { projectId } = await requireManagerContext();
  const result = await listRequirementChanges(projectId, filters);
  return <RequirementChangeListScreen result={result} filters={filters} />;
}
