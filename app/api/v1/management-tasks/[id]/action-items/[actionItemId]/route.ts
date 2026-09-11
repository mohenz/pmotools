import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { archiveActionItem, updateActionItem } from "@/lib/server/action-items";

type RouteContext = { params: Promise<{ id: string; actionItemId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, actionItemId } = await context.params;
  const { projectId, userId, jobTitle } = await getLocalContext();
  try {
    const result = await updateActionItem(projectId, userId, jobTitle, id, actionItemId, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, actionItemId } = await context.params;
  const { projectId, userId, jobTitle } = await getLocalContext();
  try {
    const result = await archiveActionItem(projectId, userId, jobTitle, id, actionItemId, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
