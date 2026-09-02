import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listPortfolioPanelPreferences, updatePortfolioPanelPreferences } from "@/lib/server/portfolio-panels";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId } = await getLocalContext();
  return NextResponse.json({ data: await listPortfolioPanelPreferences(projectId) });
}

export async function PATCH(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const data = await updatePortfolioPanelPreferences(projectId, userId, await request.json());
    return NextResponse.json({ data });
  } catch (error) { return mutationErrorResponse(error); }
}
