// [WBS2 복사본] 원본: app/api/v1/requirements/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { assertMpWritableProject, getLocalContext } from "@/lib/server/mp/context";
import { createRequirement, listRequirements } from "@/lib/server/mp/requirements";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const result = await listRequirements(projectId, {
    q: params.get("q") ?? undefined,
    acceptanceStatus: params.get("acceptanceStatus") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 20,
  });
  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  try {
    // 최상위 프로젝트 선택 상태에서는 등록·엑셀 업로드 불가(2026-09-30)
    const { projectId, userId } = await assertMpWritableProject();
    const requirement = await createRequirement(projectId, userId, await request.json());
    return NextResponse.json({ data: requirement, requestId: requirement.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
