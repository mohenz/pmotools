import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { updateWeeklyReportStatus } from "@/lib/server/work-management";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  const { id } = await params;
  try {
    const body = await request.json();
    return NextResponse.json({ data: await updateWeeklyReportStatus(projectId, userId, id, body.status) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
