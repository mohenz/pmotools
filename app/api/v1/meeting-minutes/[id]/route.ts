import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { archiveMeetingMinute, updateMeetingMinute } from "@/lib/server/meeting-minutes";
import { mutationErrorResponse } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await updateMeetingMinute(projectId, userId, (await params).id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await archiveMeetingMinute(projectId, userId, (await params).id, await request.json()) }); }
  catch (error) { return mutationErrorResponse(error); }
}
