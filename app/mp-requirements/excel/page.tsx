// [WBS2 복사본] 원본: app/requirements/excel/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { MpTopLevelBlocked } from "@/features/mp/MpTopLevelBlocked";
import { getMpScope, requireManagerContext } from "@/lib/server/mp/context";
import { RequirementExcelClient } from "@/features/mp/requirements/RequirementExcelClient";

export const dynamic = "force-dynamic";

export default async function RequirementExcelPage() {
  await requireManagerContext();
  if ((await getMpScope()).isTopLevel) return <MpTopLevelBlocked title="요구사항 엑셀 업/다운로드" listHref="/mp-requirements" listLabel="요구사항정의서로" />;
  return <RequirementExcelClient />;
}
