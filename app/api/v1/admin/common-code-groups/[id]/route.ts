import { NextRequest, NextResponse } from "next/server";
import { updateGlobalCommonCodeGroup } from "@/lib/server/common-codes";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await getLocalContext();
  try {
    const result = await updateGlobalCommonCodeGroup(userId, id, await request.json());
    return NextResponse.json({ data: result.group, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}
