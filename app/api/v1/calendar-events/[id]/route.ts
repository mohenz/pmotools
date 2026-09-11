import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/server/calendar";
import { mutationErrorResponse } from "@/lib/server/http";

function scopeOf(req: NextRequest): "all" | "single" {
  return req.nextUrl.searchParams.get("scope") === "single" ? "single" : "all";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await updateCalendarEvent(projectId, (await params).id, userId, await req.json(), scopeOf(req));
    return result ? NextResponse.json({ data: result }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "일정을 찾을 수 없습니다." } }, { status: 404 });
  } catch (e) { return mutationErrorResponse(e); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await deleteCalendarEvent(projectId, (await params).id, userId, scopeOf(req));
    return result ? NextResponse.json({ data: result }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "일정을 찾을 수 없습니다." } }, { status: 404 });
  } catch (e) { return mutationErrorResponse(e); }
}
