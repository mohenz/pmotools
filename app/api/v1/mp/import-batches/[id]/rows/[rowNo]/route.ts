import { NextResponse } from "next/server";
import { assertMpWritableProject } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { importFailureResponse } from "@/lib/server/mp/import-errors";
import { updateStagedRow } from "@/lib/server/mp/import-staging";

type RouteContext = { params: Promise<{ id: string; rowNo: string }> };

// 오류 행 화면 수정 → 배치 전체 재검증 (정상 행은 수정 불가)
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { projectId, userId } = await assertMpWritableProject();
    const { id, rowNo } = await params;
    return NextResponse.json({ data: await updateStagedRow(projectId, userId, id, Number(rowNo), await request.json()) });
  } catch (error) { return importFailureResponse(error) ?? mutationErrorResponse(error); }
}
