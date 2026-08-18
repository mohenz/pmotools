import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createManagementTask, listManagementTasks } from "@/lib/server/management-tasks";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const result = await listManagementTasks(projectId, {
    q: params.get("q") ?? undefined,
    groupId: params.get("groupId") ?? undefined,
    band: params.get("band") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 30,
  });
  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await createManagementTask(projectId, userId, await request.json());
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
