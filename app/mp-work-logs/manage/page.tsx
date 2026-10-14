// [WBS2 복사본] 원본: app/work-logs/manage/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/mp/context";
import { listManagedWorkLogs } from "@/lib/server/mp/work-logs";
import { WorkLogManagementScreen } from "@/screens/mp/WorkLogManagementScreen";
import { DomainError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";

export default async function WorkLogManagementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, userId } = await getLocalContext();
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const pageSize = value("pageSize") === "all" ? "all" as const : [20, 40, 60, 80, 100].includes(Number(value("pageSize"))) ? Number(value("pageSize")) : 20;
  const filters = { q: value("q"), dateFrom: value("dateFrom"), dateTo: value("dateTo"), groupId: value("groupId"), assigneeId: value("assigneeId"), status: value("status"), page: Number(value("page")) || 1, pageSize };
  try {
    const data = await listManagedWorkLogs(projectId, userId, filters);
    return <WorkLogManagementScreen {...data} filters={filters} />;
  } catch (error) {
    if (error instanceof DomainError && error.code === "FORBIDDEN") redirect("/mp-work-logs");
    throw error;
  }
}
