import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { getManagementTaskDetail, updateManagementTask } from "@/lib/server/management-tasks";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getLocalContext();
  const detail = await getManagementTaskDetail(projectId, id);
  return detail ? NextResponse.json({ data: detail }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "관리업무항목을 찾을 수 없습니다." } }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateManagementTask(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
