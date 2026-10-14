import { NextRequest, NextResponse } from "next/server";
import { assertMpWritableProject, getMpScope } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { importFailureResponse } from "@/lib/server/mp/import-errors";
import { createImportBatch, getMyImportBatch, parseImportKind } from "@/lib/server/mp/import-staging";

// 엑셀 업로드 임시 저장(2026-09-30) — GET: 내 임시 배치(없으면 null), POST: 파일 업로드 → 임시 저장 + 검증(기존 배치 교체)
export async function GET(request: NextRequest) {
  try {
    const kind = parseImportKind(request.nextUrl.searchParams.get("kind"));
    const scope = await getMpScope();
    if (scope.isTopLevel) return NextResponse.json({ data: null });
    return NextResponse.json({ data: await getMyImportBatch(scope.context.projectId, scope.context.userId, kind) });
  } catch (error) { return mutationErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    // 최상위 프로젝트 선택 상태에서는 등록·엑셀 업로드 불가(2026-09-30)
    const { projectId, userId } = await assertMpWritableProject();
    const form = await request.formData();
    const kind = parseImportKind(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "엑셀 파일을 첨부해 주세요." } }, { status: 400 });
    const view = await createImportBatch(projectId, userId, kind, file.name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: view }, { status: 201 });
  } catch (error) { return importFailureResponse(error) ?? mutationErrorResponse(error); }
}
