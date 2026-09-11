import { notFound } from "next/navigation";
import { canViewAllWbs } from "@/lib/domain/job-access";
import { getLocalContext } from "@/lib/server/context";
import { getWbsItemDetail, listWbsItemsExcelColumns } from "@/lib/server/wbs";
import { WbsDetailScreen } from "@/screens/WbsDetailScreen";

export const dynamic = "force-dynamic";

export default async function WbsItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId, role } = await getLocalContext();
  const [detail, excelList] = await Promise.all([getWbsItemDetail(projectId, id), listWbsItemsExcelColumns(projectId, { pageSize: "all" })]);
  if (!detail) notFound();
  if (!canViewAllWbs(role) && detail.item.ownerUserId !== userId) notFound();
  const excelRow = excelList.rows.find((row) => row.id === id) ?? null;
  return <WbsDetailScreen detail={detail} excelRow={excelRow} viewer={{ userId, canViewAllWbs: canViewAllWbs(role) }} />;
}
