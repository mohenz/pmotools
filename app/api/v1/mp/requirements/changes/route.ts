// [WBS2 복사본] 원본: app/api/v1/requirements/changes/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/mp/context";
import { listRequirementChanges } from "@/lib/server/mp/requirements";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const result = await listRequirementChanges(projectId, {
    status: params.get("status") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 20,
  });
  return NextResponse.json({ data: result });
}
