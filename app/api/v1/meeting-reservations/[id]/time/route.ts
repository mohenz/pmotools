import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { changeMeetingReservationTime } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { const c = await getLocalContext(); try { return NextResponse.json({ data: await changeMeetingReservationTime(c.projectId, c.userId, (await ctx.params).id, c.role === "ADMIN", await req.json()) }); } catch (e) { return mutationErrorResponse(e); } }
