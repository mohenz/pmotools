import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { updateUserProfile } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateUserProfile(projectId, userId, id, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
