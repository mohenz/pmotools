import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { updateMyProfile } from "@/lib/server/users";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateMyProfile(projectId, userId, await request.json());
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
