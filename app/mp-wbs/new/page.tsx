// [WBS2 복사본] 원본: app/wbs/new/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { MpTopLevelBlocked } from "@/features/mp/MpTopLevelBlocked";
import { getMpScope, requireManagerContext } from "@/lib/server/mp/context";
import { listProjectMembers } from "@/lib/server/users";
import { listWbsItems, listWbsWorkGroups } from "@/lib/server/mp/wbs";
import { WbsCreateScreen } from "@/screens/mp/WbsCreateScreen";

export const dynamic = "force-dynamic";

export default async function NewWbsItemPage() {
  const { projectId } = await requireManagerContext();
  if ((await getMpScope()).isTopLevel) return <MpTopLevelBlocked title="WBS 항목 등록" listHref="/mp-wbs" listLabel="WBS 목록" />;
  const [items, groups, members] = await Promise.all([listWbsItems(projectId), listWbsWorkGroups(projectId), listProjectMembers(projectId)]);
  return <WbsCreateScreen items={items} groups={groups} members={members} />;
}
