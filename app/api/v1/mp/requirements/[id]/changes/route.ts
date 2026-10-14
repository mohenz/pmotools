// [WBS2 복사본] 원본: app/api/v1/requirements/[id]/changes/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { getMpItemContext } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { createRequirementChange, listRequirementChanges } from "@/lib/server/mp/requirements";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getMpItemContext("requirement", id);
  const params = request.nextUrl.searchParams;
  const result = await listRequirementChanges(projectId, {
    requirementId: id,
    status: params.get("status") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 20,
  });
  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getMpItemContext("requirement", id);
  try {
    const result = await createRequirementChange(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
