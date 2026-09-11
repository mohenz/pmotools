import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { generateWeeklyReport } from "@/lib/server/work-management";

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await generateWeeklyReport(projectId, userId, await request.json()) }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
