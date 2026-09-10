import { requireManagerContext } from "@/lib/server/context";
import { listWbsDelayedTasks } from "@/lib/server/wbs";
import { WbsDelayHistoryScreen } from "@/screens/WbsDelayHistoryScreen";

export const dynamic = "force-dynamic";

export default async function WbsDelayHistoryPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; page?: string }> }) {
  const { projectId } = await requireManagerContext();
  const q = await searchParams;
  const filters = { from: q.from, to: q.to, page: q.page ? Number(q.page) : 1 };
  const result = await listWbsDelayedTasks(projectId, filters);
  return <WbsDelayHistoryScreen result={result} filters={filters} />;
}
