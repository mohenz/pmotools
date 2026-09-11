import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { updateWbsDeliverable } from "@/lib/server/wbs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateWbsDeliverable(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}
