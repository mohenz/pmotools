// [WBS2 복사본] 원본: app/api/v1/wbs-items/reset/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextResponse } from "next/server";
import { assertMpWritableProject } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { resetWbsData } from "@/lib/server/mp/wbs";

export async function POST() {
  try {
    // 최상위 프로젝트 선택 상태에서는 등록·엑셀 업로드 불가(2026-09-30)
    const { projectId, userId } = await assertMpWritableProject();
    const result = await resetWbsData(projectId, userId);
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}
