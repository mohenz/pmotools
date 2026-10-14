// [WBS2 복사본] 원본: app/api/v1/wbs-items/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { assertMpWritableProject, getLocalContext } from "@/lib/server/mp/context";
import { createWbsItem, listWbsItems } from "@/lib/server/mp/wbs";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId } = await getLocalContext();
  const items = await listWbsItems(projectId);
  return NextResponse.json({ data: items });
}

export async function POST(request: NextRequest) {
  try {
    // 최상위 프로젝트 선택 상태에서는 등록·엑셀 업로드 불가(2026-09-30)
    const { projectId, userId } = await assertMpWritableProject();
    const item = await createWbsItem(projectId, userId, await request.json());
    return NextResponse.json({ data: item, requestId: item.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
