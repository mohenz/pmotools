import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listMeetingActionItemLogs } from "@/lib/server/meeting-action-items";
import { mutationErrorResponse } from "@/lib/server/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { projectId } = await getLocalContext();
  try { return NextResponse.json({ data: await listMeetingActionItemLogs(projectId, (await params).id) }); }
  catch (error) { return mutationErrorResponse(error); }
}
