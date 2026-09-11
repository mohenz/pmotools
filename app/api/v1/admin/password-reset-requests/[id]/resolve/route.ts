import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { resolvePasswordResetRequest } from "@/lib/server/password-reset-requests";
import { mutationErrorResponse } from "@/lib/server/http";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await resolvePasswordResetRequest(projectId, userId, id);
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
