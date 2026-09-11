import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { getWbsItemDetail, updateWbsItem } from "@/lib/server/wbs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getLocalContext();
  const detail = await getWbsItemDetail(projectId, id);
  return detail ? NextResponse.json({ data: detail }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "WBS 항목을 찾을 수 없습니다." } }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateWbsItem(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
