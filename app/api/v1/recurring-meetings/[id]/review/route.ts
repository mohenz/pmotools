import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLocalContext } from "@/lib/server/context";
import { reviewRecurringMeeting } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
const schema = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().max(500).optional() });
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { const c = await getLocalContext(); try { const data = schema.parse(await req.json()); return NextResponse.json({ data: await reviewRecurringMeeting(c.projectId, c.userId, (await ctx.params).id, data.action, data.reason) }); } catch (e) { return mutationErrorResponse(e); } }
