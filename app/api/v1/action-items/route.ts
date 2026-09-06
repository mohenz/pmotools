import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { hasPmPmoAccess } from "@/lib/domain/job-access";
import { listProjectActionItems } from "@/lib/server/action-items";

export async function GET(request: NextRequest) {
  const context = await getLocalContext();
  if (!hasPmPmoAccess(context.jobTitle, context.role)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "PM/PMO만 사용할 수 있습니다." } }, { status: 403 });
  const params = request.nextUrl.searchParams;
  const result = await listProjectActionItems(context.projectId, {
    q: params.get("q") ?? undefined,
    status: params.get("status") ?? undefined,
    groupId: params.get("groupId") ?? undefined,
    assigneeId: params.get("assigneeId") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 30,
  });
  return NextResponse.json({ data: result });
}
