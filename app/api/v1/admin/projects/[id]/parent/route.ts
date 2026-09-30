import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { updateProjectParent } from "@/lib/server/projects-admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await getLocalContext();
  try {
    const project = await updateProjectParent(userId, id, await request.json());
    return NextResponse.json({ data: project });
  } catch (error) { return mutationErrorResponse(error); }
}
