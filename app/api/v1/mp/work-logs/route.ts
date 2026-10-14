// [WBS2 복사본] 원본: app/api/v1/work-logs/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/mp/context";
import { createWorkLog, getWorkLogIdentity, listWorkLogs } from "@/lib/server/mp/work-logs";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  const p = request.nextUrl.searchParams;
  const identity = await getWorkLogIdentity(projectId, userId);
  return NextResponse.json({ data: await listWorkLogs(projectId, { q: p.get("q") ?? undefined, dateFrom: p.get("dateFrom") ?? undefined, dateTo: p.get("dateTo") ?? undefined, groupId: identity.group?.id, assigneeId: userId, status: p.get("status") ?? undefined, page: Number(p.get("page")) || 1 }) });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await createWorkLog(projectId, userId, await request.json()) }, { status: 201 }); }
  catch (error) { return mutationErrorResponse(error); }
}
