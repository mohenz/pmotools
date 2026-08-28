import { getLocalContext } from "@/lib/server/context";
import { listRequirementCodeOptions, listRequirements } from "@/lib/server/requirements";
import { RequirementListScreen } from "@/screens/RequirementListScreen";

export const dynamic = "force-dynamic";

export default async function RequirementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    q: typeof params.q === "string" ? params.q : "",
    acceptanceStatus: typeof params.acceptanceStatus === "string" ? params.acceptanceStatus : "",
    divisionCodeId: typeof params.divisionCodeId === "string" ? params.divisionCodeId : "",
    priority: typeof params.priority === "string" ? params.priority : "",
    importance: typeof params.importance === "string" ? params.importance : "",
    pageSize: params.pageSize === "all" ? "all" as const : typeof params.pageSize === "string" && [20, 40, 60, 80, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 20,
    page: typeof params.page === "string" ? Number(params.page) || 1 : 1,
  };
  const { projectId, role } = await getLocalContext();
  const isManager = role === "ADMIN" || role === "OPERATOR" || role === "SUPER_ADMIN";
  const [result, codes] = await Promise.all([listRequirements(projectId, filters), listRequirementCodeOptions(projectId)]);
  return <RequirementListScreen result={result} filters={filters} divisions={codes.divisions} isManager={isManager} />;
}
