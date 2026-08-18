import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { updateWeeklyReportStatus } from "@/lib/server/work-management";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ weekId: string }> }) {
  const { projectId, userId } = await getLocalContext();
  const { weekId } = await params;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await updateWeeklyReportStatus(projectId, userId, weekId, body.status) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
