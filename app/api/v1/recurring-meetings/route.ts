import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createRecurringMeeting, listRecurringMeetings } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function GET() { const c = await getLocalContext(); return NextResponse.json({ data: await listRecurringMeetings(c.projectId, c.userId, c.role === "ADMIN") }); }
export async function POST(req: NextRequest) { const c = await getLocalContext(); try { return NextResponse.json({ data: await createRecurringMeeting(c.projectId, c.userId, await req.json()) }, { status: 201 }); } catch (e) { return mutationErrorResponse(e); } }
