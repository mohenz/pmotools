import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getWbsItemDetail, listWbsItemsExcelColumns } from "@/lib/server/wbs";
import { WbsDetailScreen } from "@/screens/WbsDetailScreen";

export const dynamic = "force-dynamic";

export default async function WbsItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await getLocalContext();
  const [detail, excelList] = await Promise.all([getWbsItemDetail(projectId, id), listWbsItemsExcelColumns(projectId, { pageSize: "all" })]);
  if (!detail) notFound();
  const excelRow = excelList.rows.find((row) => row.id === id) ?? null;
  return <WbsDetailScreen detail={detail} excelRow={excelRow} />;
}
