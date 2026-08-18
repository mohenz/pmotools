import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteUser } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await deleteUser(projectId, userId, id) });
  } catch (error) { return mutationErrorResponse(error); }
}
