// [WBS2 복사본] 원본: app/wbs/[id]/edit/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound } from "next/navigation";
import { canViewAllWbs } from "@/lib/domain/job-access";
import { getMpItemContext } from "@/lib/server/mp/context";
import { listProjectMembers } from "@/lib/server/users";
import { getWbsItemDetail, listWbsItems, listWbsItemsExcelColumns, listWbsWorkGroups } from "@/lib/server/mp/wbs";
import { WbsEditScreen } from "@/screens/mp/WbsEditScreen";

export const dynamic = "force-dynamic";

export default async function EditWbsItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId, role } = await getMpItemContext("wbsItem", id);
  const [detail, items, groups, members, excelList] = await Promise.all([
    getWbsItemDetail(projectId, id), listWbsItems(projectId), listWbsWorkGroups(projectId), listProjectMembers(projectId),
    listWbsItemsExcelColumns(projectId, { pageSize: "all" }),
  ]);
  if (!detail) notFound();
  if (!canViewAllWbs(role) && detail.item.ownerUserId !== userId) notFound();
  const excelRow = excelList.rows.find((row) => row.id === id) ?? null;
  return <WbsEditScreen detail={detail} items={items} groups={groups} members={members} excelRow={excelRow} />;
}
