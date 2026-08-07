import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { updateGroup } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const group = await updateGroup(projectId, userId, id, await request.json());
    return NextResponse.json({ data: group });
  } catch (error) { return mutationErrorResponse(error); }
}
