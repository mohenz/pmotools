import { redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { listManagedWorkLogs } from "@/lib/server/work-logs";
import { WorkLogManagementScreen } from "@/screens/WorkLogManagementScreen";
import { DomainError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";

export default async function WorkLogManagementPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, userId } = await getLocalContext();
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filters = { q: value("q"), dateFrom: value("dateFrom"), dateTo: value("dateTo"), groupId: value("groupId"), assigneeId: value("assigneeId"), status: value("status"), page: Number(value("page")) || 1 };
  try {
    const data = await listManagedWorkLogs(projectId, userId, filters);
    return <WorkLogManagementScreen {...data} filters={filters} />;
  } catch (error) {
    if (error instanceof DomainError && error.code === "FORBIDDEN") redirect("/work-logs");
    throw error;
  }
}
