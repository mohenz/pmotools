import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { listProjectMembers } from "@/lib/server/users";
import { getWbsItemDetail, listWbsItems, listWbsItemsExcelColumns, listWbsWorkGroups } from "@/lib/server/wbs";
import { WbsEditScreen } from "@/screens/WbsEditScreen";

export const dynamic = "force-dynamic";

export default async function EditWbsItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await getLocalContext();
  const [detail, items, groups, members, excelList] = await Promise.all([
    getWbsItemDetail(projectId, id), listWbsItems(projectId), listWbsWorkGroups(projectId), listProjectMembers(projectId),
    listWbsItemsExcelColumns(projectId, { pageSize: "all" }),
  ]);
  if (!detail) notFound();
  const excelRow = excelList.rows.find((row) => row.id === id) ?? null;
  return <WbsEditScreen detail={detail} items={items} groups={groups} members={members} excelRow={excelRow} />;
}
