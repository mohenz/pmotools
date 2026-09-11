import { requireManagerContext } from "@/lib/server/context";
import { listRequirementChanges } from "@/lib/server/requirements";
import { RequirementChangeListScreen } from "@/screens/RequirementChangeListScreen";

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
