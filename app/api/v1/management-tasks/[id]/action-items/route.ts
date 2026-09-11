import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { createActionItem, listManagementTaskActionItems } from "@/lib/server/action-items";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getLocalContext();
  const axes = await listManagementTaskActionItems(projectId, id);
  return axes ? NextResponse.json({ data: axes }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "관리업무항목을 찾을 수 없습니다." } }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId, jobTitle } = await getLocalContext();
  try {
    const { detailItemId, ...rest } = await request.json();
    const result = await createActionItem(projectId, userId, jobTitle, id, detailItemId, rest);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
