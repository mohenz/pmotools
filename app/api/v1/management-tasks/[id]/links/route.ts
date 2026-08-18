import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { linkManagementTasks, unlinkManagementTasks } from "@/lib/server/management-tasks";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await linkManagementTasks(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await unlinkManagementTasks(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
