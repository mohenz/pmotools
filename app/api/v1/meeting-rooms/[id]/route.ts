import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteMeetingRoom, updateMeetingRoom } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { const c = await getLocalContext(); try { return NextResponse.json({ data: await updateMeetingRoom(c.projectId, c.userId, (await ctx.params).id, await req.json()) }); } catch (e) { return mutationErrorResponse(e); } }
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) { const c = await getLocalContext(); try { return NextResponse.json({ data: await deleteMeetingRoom(c.projectId, c.userId, (await ctx.params).id) }); } catch (e) { return mutationErrorResponse(e); } }
