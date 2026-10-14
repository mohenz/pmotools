// [WBS2 복사본] 원본: app/requirements/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getMpScope } from "@/lib/server/mp/context";
import { listRequirementCodeOptions, listRequirements } from "@/lib/server/mp/requirements";
import { RequirementListScreen } from "@/screens/mp/RequirementListScreen";

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
    projectCode: typeof params.projectCode === "string" ? params.projectCode : "",
  };
  // 최상위 프로젝트를 고르면 하위 프로젝트 요구사항까지 합쳐 보여준다(2026-09-30).
  const scope = await getMpScope(), { projectId, role } = scope.context;
  const isManager = role === "ADMIN" || role === "OPERATOR" || role === "SUPER_ADMIN";
  if (!scope.isTopLevel) {
    const [result, codes] = await Promise.all([listRequirements(projectId, { ...filters, projectCode: "" }), listRequirementCodeOptions(projectId)]);
    return <RequirementListScreen result={result} filters={filters} divisions={codes.divisions} isManager={isManager} />;
  }
  const [result, codeLists] = await Promise.all([listRequirements(scope.projectIds, filters), Promise.all(scope.projectIds.map((id) => listRequirementCodeOptions(id)))]);
  // 요구사항구분은 프로젝트마다 코드 id가 달라 이름 기준으로 합쳐 선택지를 만든다(값 = 이름).
  const labels = Array.from(new Set(codeLists.flatMap((codes) => codes.divisions.map((code) => code.label))));
  const divisions = labels.map((label) => ({ ...codeLists.flatMap((codes) => codes.divisions).find((code) => code.label === label)!, id: label }));
  return <RequirementListScreen result={result} filters={filters} divisions={divisions} isManager={isManager} topLevel={{ projects: scope.projects.map(({ id, code, name }) => ({ id, code, name })) }} />;
}
