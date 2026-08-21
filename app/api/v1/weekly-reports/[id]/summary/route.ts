import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { generateWeeklySummary, getWeeklySummary } from "@/lib/server/weekly-report-summary";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId } = await getLocalContext();
  return NextResponse.json({ data: await getWeeklySummary(projectId, (await params).id) });
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await generateWeeklySummary(projectId, userId, (await params).id) }, { status: 201 });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
