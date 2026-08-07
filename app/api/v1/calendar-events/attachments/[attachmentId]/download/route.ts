import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { getAttachmentDownloadUrl } from "@/lib/server/storage";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const { projectId } = await getLocalContext();
  try {
    const url = await getAttachmentDownloadUrl(projectId, attachmentId);
    return NextResponse.redirect(url);
  } catch (error) { return mutationErrorResponse(error); }
}
