// [WBS2 복사본] 원본: app/api/v1/wbs-items/[id]/deliverable/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { getMpItemContext } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { updateWbsDeliverable } from "@/lib/server/mp/wbs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getMpItemContext("wbsItem", id);
  try {
    const result = await updateWbsDeliverable(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}
