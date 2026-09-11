import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { acknowledgeMeetingInvitations, listUnreadMeetingInvitations } from "@/lib/server/meeting-invitations";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { userId } = await getLocalContext();
  return NextResponse.json({ data: await listUnreadMeetingInvitations(userId) });
}

export async function PATCH(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await acknowledgeMeetingInvitations(userId, await request.json()) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
