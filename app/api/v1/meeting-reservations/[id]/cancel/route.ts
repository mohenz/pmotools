import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { cancelMeetingReservation } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function PATCH(_: NextRequest, ctx: { params: Promise<{ id: string }> }) { const c = await getLocalContext(); try { return NextResponse.json({ data: await cancelMeetingReservation(c.projectId, c.userId, (await ctx.params).id, c.role === "ADMIN" || c.role === "SUPER_ADMIN") }); } catch (e) { return mutationErrorResponse(e); } }
