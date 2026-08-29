import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { resetWbsData } from "@/lib/server/wbs";

export async function POST() {
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await resetWbsData(projectId, userId);
    return NextResponse.json({ data: result, requestId: result.requestId });
  } catch (error) { return mutationErrorResponse(error); }
}
