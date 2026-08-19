import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { acknowledgeCalendarInvitations, listUnreadCalendarInvitations } from "@/lib/server/calendar-invitations";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { userId } = await getLocalContext();
  return NextResponse.json({ data: await listUnreadCalendarInvitations(userId) });
}

export async function PATCH(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await acknowledgeCalendarInvitations(userId, await request.json()) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
