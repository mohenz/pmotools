// [WBS2 복사본] 원본: app/wbs/[id]/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound } from "next/navigation";
import { canViewAllWbs } from "@/lib/domain/job-access";
import { getMpItemContext } from "@/lib/server/mp/context";
import { getWbsItemDetail, listWbsItemsExcelColumns } from "@/lib/server/mp/wbs";
import { WbsDetailScreen } from "@/screens/mp/WbsDetailScreen";

export const dynamic = "force-dynamic";

export default async function WbsItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId, role } = await getMpItemContext("wbsItem", id);
  const [detail, excelList] = await Promise.all([getWbsItemDetail(projectId, id), listWbsItemsExcelColumns(projectId, { pageSize: "all" })]);
  if (!detail) notFound();
  if (!canViewAllWbs(role) && detail.item.ownerUserId !== userId) notFound();
  const excelRow = excelList.rows.find((row) => row.id === id) ?? null;
  return <WbsDetailScreen detail={detail} excelRow={excelRow} viewer={{ userId, canViewAllWbs: canViewAllWbs(role) }} />;
}
