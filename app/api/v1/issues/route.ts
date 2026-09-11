import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { createIssue, listIssues } from "@/lib/server/issues";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const issues = await listIssues(projectId, {
    q: params.get("q") ?? undefined,
    categoryCodeId: params.get("categoryCodeId") ?? undefined,
    status: params.get("status") ?? undefined,
    importance: params.get("importance") ?? undefined,
    priority: params.get("priority") ?? undefined,
    escalated: params.has("escalated") ? params.get("escalated") === "true" : undefined,
    ownerUserId: params.get("ownerUserId") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 30,
  });
  return NextResponse.json({ data: issues });
}

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const issue = await createIssue(projectId, userId, await request.json());
    return NextResponse.json({ data: issue, requestId: issue.requestId }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
