import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteRecurringMeeting, updateRecurringMeeting } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const c = await getLocalContext();
  try { return NextResponse.json({ data: await updateRecurringMeeting(c.projectId, c.userId, (await ctx.params).id, await req.json()) }); }
  catch (e) { return mutationErrorResponse(e); }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const c = await getLocalContext();
  try { return NextResponse.json({ data: await deleteRecurringMeeting(c.projectId, c.userId, (await ctx.params).id) }); }
  catch (e) { return mutationErrorResponse(e); }
}
