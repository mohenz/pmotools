import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { validateRequirementsImport } from "@/lib/server/requirements-excel";
import { mutationErrorResponse } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  const { projectId } = await getLocalContext();
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "엑셀 파일을 첨부해 주세요." } }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await validateRequirementsImport(projectId, buffer);
    return NextResponse.json({ data: report });
  } catch (error) { return mutationErrorResponse(error); }
}
