import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { restoreMeetingRoom } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function POST(_: NextRequest, ctx: { params: Promise<{ id: string }> }) { const c = await getLocalContext(); try { return NextResponse.json({ data: await restoreMeetingRoom(c.projectId, c.userId, (await ctx.params).id) }); } catch (e) { return mutationErrorResponse(e); } }
