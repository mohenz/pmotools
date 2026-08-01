import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { updateEscalation } from "@/lib/server/items";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = getLocalContext();
  try {
    const result = await updateEscalation(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}

