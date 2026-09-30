import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createMeetingMinute } from "@/lib/server/meeting-minutes";
import { mutationErrorResponse } from "@/lib/server/http";

export async function POST(request: Request) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await createMeetingMinute(projectId, userId, await request.json()) }, { status: 201 }); }
  catch (error) { return mutationErrorResponse(error); }
}
