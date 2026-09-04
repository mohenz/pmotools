import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { deleteProgressEntry, updateProgressEntry } from "@/lib/server/issues";

type RouteContext = { params: Promise<{ id: string; entryId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id, entryId } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateProgressEntry(projectId, userId, id, entryId, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id, entryId } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await deleteProgressEntry(projectId, userId, id, entryId);
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}
