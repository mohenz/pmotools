import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { createRequirementChange, listRequirementChanges } from "@/lib/server/requirements";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const result = await listRequirementChanges(projectId, {
    requirementId: id,
    status: params.get("status") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 20,
  });
  return NextResponse.json({ data: result });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await createRequirementChange(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
