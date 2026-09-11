import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { applyImport } from "@/lib/server/calendar-excel";
import { mutationErrorResponse } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  const { projectId, userId } = await getLocalContext();
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "엑셀 파일을 첨부해 주세요." } }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await applyImport(projectId, userId, buffer);
    if (result.report.errorCount > 0) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "검증에 실패한 행이 있어 반영하지 않았습니다." }, data: result.report }, { status: 400 });
    return NextResponse.json({ data: result });
  } catch (error) { return mutationErrorResponse(error); }
}
