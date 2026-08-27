import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { getWorkLogDetail, updateWorkLog } from "@/lib/server/work-logs";
import { mutationErrorResponse } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params, { projectId, userId } = await getLocalContext();
  const detail = await getWorkLogDetail(projectId, id, userId);
  return detail ? NextResponse.json({ data: detail }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "업무일지를 찾을 수 없습니다." } }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params, { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await updateWorkLog(projectId, userId, id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}
