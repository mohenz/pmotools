// [WBS2 복사본] 원본: app/api/v1/wbs-items/[id]/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { getMpItemContext } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { getWbsItemDetail, updateWbsItem } from "@/lib/server/mp/wbs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getMpItemContext("wbsItem", id);
  const detail = await getWbsItemDetail(projectId, id);
  return detail ? NextResponse.json({ data: detail }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "WBS 항목을 찾을 수 없습니다." } }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getMpItemContext("wbsItem", id);
  try {
    const result = await updateWbsItem(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
