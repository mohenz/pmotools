import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listEventAttachments, uploadEventAttachment } from "@/lib/server/storage";
import { mutationErrorResponse } from "@/lib/server/http";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ data: await listEventAttachments(id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "파일을 첨부해 주세요." } }, { status: 400 });
    const attachment = await uploadEventAttachment(projectId, id, userId, file);
    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}
