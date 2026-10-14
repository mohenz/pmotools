// [WBS2 복사본] 원본: app/api/v1/wbs-items/excel/import/validate/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { NextRequest, NextResponse } from "next/server";
import { assertMpWritableProject } from "@/lib/server/mp/context";
import { validateWbsImport } from "@/lib/server/mp/wbs-excel";
import { mutationErrorResponse } from "@/lib/server/http";
import { importFailureResponse } from "@/lib/server/mp/import-errors";

export async function POST(request: NextRequest) {
  try {
    // 최상위 프로젝트 선택 상태에서는 등록·엑셀 업로드 불가(2026-09-30)
    const { projectId } = await assertMpWritableProject();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "엑셀 파일을 첨부해 주세요." } }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const report = await validateWbsImport(projectId, buffer);
    return NextResponse.json({ data: report });
  } catch (error) { return importFailureResponse(error) ?? mutationErrorResponse(error); }
}
