// [WBS2 복사본] 원본: app/wbs/delay-history/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getMpScope } from "@/lib/server/mp/context";
import { listWbsDelayedTasks } from "@/lib/server/mp/wbs";
import { WbsDelayHistoryScreen } from "@/screens/mp/WbsDelayHistoryScreen";

export const dynamic = "force-dynamic";

export default async function WbsDelayHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string; pageSize?: string }>;
}) {
  const scope = await getMpScope();
  const q = await searchParams;
  const pageSizeParam = q.pageSize;
  const pageSize: number | "all" = pageSizeParam === "all"
    ? "all"
    : typeof pageSizeParam === "string" && [20, 40, 60, 80, 100].includes(Number(pageSizeParam))
    ? Number(pageSizeParam)
    : 20;
  const page = typeof q.page === "string" ? Number(q.page) || 1 : 1;
  const filters = { from: q.from, to: q.to, page, pageSize };
  const targetId = scope.isTopLevel ? scope.projects.map((p) => p.id) : scope.context.projectId;
  const result = await listWbsDelayedTasks(targetId, filters);
  return <WbsDelayHistoryScreen result={result} filters={filters} />;
}
