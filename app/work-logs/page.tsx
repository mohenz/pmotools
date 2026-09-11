import { getLocalContext } from "@/lib/server/context";
import { getWorkLogIdentity, listWorkLogs } from "@/lib/server/work-logs";
import { WorkLogListScreen } from "@/screens/WorkLogListScreen";

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
