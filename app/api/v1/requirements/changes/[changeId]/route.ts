import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { decideRequirementChange } from "@/lib/server/requirements";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ changeId: string }> }) {
  const { changeId } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await decideRequirementChange(projectId, userId, changeId, await request.json());
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
