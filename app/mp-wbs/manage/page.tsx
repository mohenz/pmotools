// [WBS2 복사본] 원본: app/wbs/manage/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { MpTopLevelBlocked } from "@/features/mp/MpTopLevelBlocked";
import { getMpScope, requireManagerContext } from "@/lib/server/mp/context";
import { WbsManageScreen } from "@/screens/mp/WbsManageScreen";

export const dynamic = "force-dynamic";

export default async function WbsManagePage() {
  await requireManagerContext();
  if ((await getMpScope()).isTopLevel) return <MpTopLevelBlocked title="WBS 데이터 관리" listHref="/mp-wbs" listLabel="WBS 목록" />;
  return <WbsManageScreen />;
}
