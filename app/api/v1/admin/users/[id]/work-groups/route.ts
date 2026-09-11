import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { updateUserWorkGroups } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await updateUserWorkGroups(projectId, userId, id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}
