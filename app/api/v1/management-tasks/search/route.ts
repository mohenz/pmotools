import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { searchManagementTasks } from "@/lib/server/management-tasks";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const params = request.nextUrl.searchParams;
  const results = await searchManagementTasks(projectId, params.get("q") ?? "", params.get("excludeId") ?? undefined);
  return NextResponse.json({ data: results });
}
