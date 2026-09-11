import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { getIssueDetail } from "@/lib/server/issues";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { projectId } = await getLocalContext();
  const detail = await getIssueDetail(projectId, id);
  return detail ? NextResponse.json({ data: detail }) : NextResponse.json({ error: { code: "NOT_FOUND", message: "이슈를 찾을 수 없습니다." } }, { status: 404 });
}
