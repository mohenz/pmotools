import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createWorkLog, getWorkLogIdentity, listWorkLogs } from "@/lib/server/work-logs";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  const p = request.nextUrl.searchParams;
  const identity = await getWorkLogIdentity(projectId, userId);
  return NextResponse.json({ data: await listWorkLogs(projectId, { q: p.get("q") ?? undefined, dateFrom: p.get("dateFrom") ?? undefined, dateTo: p.get("dateTo") ?? undefined, groupId: identity.group?.id, assigneeId: userId, status: p.get("status") ?? undefined, page: Number(p.get("page")) || 1 }) });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try { return NextResponse.json({ data: await createWorkLog(projectId, userId, await request.json()) }, { status: 201 }); }
  catch (error) { return mutationErrorResponse(error); }
}
