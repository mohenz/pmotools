import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createAnnouncement, listAnnouncements } from "@/lib/server/announcements";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const page = Number(request.nextUrl.searchParams.get("page")) || 1;
  return NextResponse.json({ data: await listAnnouncements(projectId, userId, q, page) });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await createAnnouncement(projectId, userId, await request.json()) }, { status: 201 }); }
  catch (error) { return mutationErrorResponse(error); }
}
