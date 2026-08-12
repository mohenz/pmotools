import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createMeetingReservation, listMeetingReservations } from "@/lib/server/meeting-rooms";
import { mutationErrorResponse } from "@/lib/server/http";
export async function GET(req: NextRequest) { const c = await getLocalContext(), p = req.nextUrl.searchParams, from = new Date(p.get("from") ?? ""), to = new Date(p.get("to") ?? ""); if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 32 * 86_400_000) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "조회 범위는 1일 이상 32일 이하여야 합니다." } }, { status: 400 }); return NextResponse.json({ data: await listMeetingReservations(c.projectId, from, to, p.get("mine") === "1" ? c.userId : undefined) }); }
export async function POST(req: NextRequest) { const c = await getLocalContext(); try { return NextResponse.json({ data: await createMeetingReservation(c.projectId, c.userId, await req.json()) }, { status: 201 }); } catch (e) { return mutationErrorResponse(e); } }
