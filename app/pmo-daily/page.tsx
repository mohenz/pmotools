import { requirePmPmoContext } from "@/lib/server/context";
import { listPmoDailySnapshots } from "@/lib/server/pmo-daily";
import { PmoDailyListScreen } from "@/screens/PmoDailyListScreen";

export const dynamic = "force-dynamic";

export default async function PmoDailyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await requirePmPmoContext();
  const params = await searchParams;
  const dateFrom = typeof params.dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dateFrom) ? params.dateFrom : "";
  const dateTo = typeof params.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dateTo) ? params.dateTo : "";
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;
  const result = await listPmoDailySnapshots(projectId, { dateFrom, dateTo, page });
  return <PmoDailyListScreen result={result} filters={{ dateFrom, dateTo }} />;
}
