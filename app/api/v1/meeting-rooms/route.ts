import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createMeetingRoom, listMeetingRooms } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function GET(req: NextRequest) { const c = await getLocalContext(); return NextResponse.json({ data: await listMeetingRooms(c.projectId, c.role === "ADMIN" && req.nextUrl.searchParams.get("archived") === "1") }); }
export async function POST(req: NextRequest) { const c = await getLocalContext(); try { return NextResponse.json({ data: await createMeetingRoom(c.projectId, c.userId, await req.json()) }, { status: 201 }); } catch (e) { return mutationErrorResponse(e); } }
