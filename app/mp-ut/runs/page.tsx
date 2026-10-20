import { getMpScope } from "@/lib/server/mp/context";
import { listUtRunRows } from "@/lib/server/mp/ut/defects";
import { UtRunsScreen } from "@/screens/mp/ut/UtRunsScreen";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtRunsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const filters = { q: pick("q"), defectOnly: pick("defectOnly"), openOnly: pick("openOnly"), scenarioId: pick("scenarioId") };
  const scope = await getMpScope();
  const c = scope.context;
  const rows = await listUtRunRows(scope.projectIds, { projectId: c.projectId, userId: c.userId, role: c.role, jobTitle: c.jobTitle }, { q: filters.q || undefined, defectOnly: filters.defectOnly === "1", openOnly: filters.openOnly === "1", scenarioId: filters.scenarioId || undefined });
  return <UtRunsScreen rows={rows} filters={filters} />;
}
