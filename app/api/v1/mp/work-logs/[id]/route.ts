// [WBS2 복사본] 원본: app/api/v1/work-logs/[id]/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/mp/context";
import { deleteWorkLog, getWorkLogDetail, updateWorkLog } from "@/lib/server/mp/work-logs";
import { mutationErrorResponse } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params, { projectId, userId } = await getLocalContext();
  const detail = await getWorkLogDetail(projectId, id, userId);
  return detail ? NextResponse.json({ data: detail }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "WBS상세내용을 찾을 수 없습니다." } }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params, { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await updateWorkLog(projectId, userId, id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params, { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await deleteWorkLog(projectId, userId, id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}
