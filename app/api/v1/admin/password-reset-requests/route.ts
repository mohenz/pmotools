import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listPendingPasswordResetRequests } from "@/lib/server/password-reset-requests";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET() {
  const { projectId, userId } = await getLocalContext();
  try {
    const data = await listPendingPasswordResetRequests(projectId, userId);
    return NextResponse.json({ data });
  } catch (error) { return mutationErrorResponse(error); }
}
