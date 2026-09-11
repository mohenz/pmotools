import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listRequirementChanges } from "@/lib/server/requirements";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const result = await listRequirementChanges(projectId, {
    status: params.get("status") ?? undefined,
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 20,
  });
  return NextResponse.json({ data: result });
}
