import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteAnnouncement, updateAnnouncement } from "@/lib/server/announcements";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await updateAnnouncement(projectId, userId, (await params).id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await deleteAnnouncement(projectId, userId, (await params).id) }); }
  catch (error) { return mutationErrorResponse(error); }
}
