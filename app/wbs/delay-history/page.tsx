import { requireManagerContext } from "@/lib/server/context";
import { listWbsDelayedTasks } from "@/lib/server/wbs";
import { WbsDelayHistoryScreen } from "@/screens/WbsDelayHistoryScreen";

export const dynamic = "force-dynamic";

export default async function WbsDelayHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; page?: string; pageSize?: string }>;
}) {
  const { projectId } = await requireManagerContext();
  const q = await searchParams;
  const pageSizeParam = q.pageSize;
  const pageSize: number | "all" = pageSizeParam === "all"
    ? "all"
    : typeof pageSizeParam === "string" && [20, 40, 60, 80, 100].includes(Number(pageSizeParam))
    ? Number(pageSizeParam)
    : 20;
  const page = typeof q.page === "string" ? Number(q.page) || 1 : 1;
  const filters = { from: q.from, to: q.to, page, pageSize };
  const result = await listWbsDelayedTasks(projectId, filters);
  return <WbsDelayHistoryScreen result={result} filters={filters} />;
}
