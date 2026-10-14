// [WBS2 복사본] 원본: app/work-logs/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getLocalContext } from "@/lib/server/mp/context";
import { getWorkLogIdentity, listWorkLogs } from "@/lib/server/mp/work-logs";
import { WorkLogListScreen } from "@/screens/mp/WorkLogListScreen";

export const dynamic = "force-dynamic";

export default async function WorkLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, userId } = await getLocalContext(), p = await searchParams;
  const value = (key: string) => typeof p[key] === "string" ? p[key] as string : "";
  const identity = await getWorkLogIdentity(projectId, userId);
  const pageSize = value("pageSize") === "all" ? "all" as const : [20, 40, 60, 80, 100].includes(Number(value("pageSize"))) ? Number(value("pageSize")) : 20;
  const filters = { q: value("q"), dateFrom: value("dateFrom"), dateTo: value("dateTo"), groupId: identity.group?.id ?? "", assigneeId: userId, status: value("status"), page: Number(value("page")) || 1, pageSize };
  const result = await listWorkLogs(projectId, filters);
  return <WorkLogListScreen result={result} filters={filters} identity={identity} />;
}
