import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { resetUserPassword } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const body = await request.json().catch(() => ({}));
    const result = await resetUserPassword(projectId, userId, id, body);
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
