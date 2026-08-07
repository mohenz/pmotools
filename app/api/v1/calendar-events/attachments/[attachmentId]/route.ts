import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { deleteEventAttachment } from "@/lib/server/storage";
import { mutationErrorResponse } from "@/lib/server/http";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const result = await deleteEventAttachment(projectId, attachmentId, userId);
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
