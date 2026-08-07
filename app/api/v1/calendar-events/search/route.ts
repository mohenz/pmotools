import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { searchCalendarEvents } from "@/lib/server/calendar";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const data = await searchCalendarEvents(projectId, {
    q: params.get("q") ?? undefined,
    priority: params.get("priority") ?? undefined,
    groupId: params.get("groupId") ?? undefined,
    assigneeId: params.get("assigneeId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
  return NextResponse.json({ data });
}
