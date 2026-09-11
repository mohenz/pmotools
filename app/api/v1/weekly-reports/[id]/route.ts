import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteWeeklyReport } from "@/lib/server/work-management";
import { mutationErrorResponse } from "@/lib/server/http";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await deleteWeeklyReport(projectId, userId, (await params).id) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
