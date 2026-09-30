import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { changeMeetingActionStatus } from "@/lib/server/meeting-action-items";
import { mutationErrorResponse } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

// 회의록 Action Item 진행상태 변경 — 프로젝트 멤버 누구나(2026-09-30 결정)
export async function PATCH(request: Request, { params }: RouteContext) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await changeMeetingActionStatus(projectId, userId, (await params).id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}
