import { getLocalContext } from "@/lib/server/context";
import { listWbsItemsExcelColumns } from "@/lib/server/wbs";
import { WbsListScreen } from "@/screens/WbsListScreen";

export const dynamic = "force-dynamic";

export default async function WbsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await getLocalContext(), p = await searchParams;
  const value = (key: string) => typeof p[key] === "string" ? p[key] as string : "";
  const numberOrUndefined = (key: string) => value(key) === "" ? undefined : Number(value(key));
  const pageSize = value("pageSize") === "all" ? "all" as const : [10, 20, 40, 60, 80, 100].includes(Number(value("pageSize"))) ? Number(value("pageSize")) : 20;
  const filters = {
    page: Number(value("page")) || 1, pageSize, q: value("q"), assignee: value("assignee"),
    startDate: value("startDate"), dueDate: value("dueDate"), groupLabel: value("groupLabel"),
    leaf: (value("leaf") === "y" || value("leaf") === "n" ? value("leaf") : "") as "" | "y" | "n",
    plannedMin: numberOrUndefined("plannedMin"), actualMin: numberOrUndefined("actualMin"), progressMin: numberOrUndefined("progressMin"),
  };
  const result = await listWbsItemsExcelColumns(projectId, filters);
  return <WbsListScreen result={result} filters={filters} />;
}
