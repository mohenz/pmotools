import { NextResponse } from "next/server";
import { z } from "zod";
import { assertMpWritableProject } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { importFailureResponse } from "@/lib/server/mp/import-errors";
import { applyImportBatch } from "@/lib/server/mp/import-staging";

type RouteContext = { params: Promise<{ id: string }> };

// 임시 배치 반영 — 성공하면 배치 삭제, 검증 실패면 400과 갱신된 배치
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId, userId } = await assertMpWritableProject();
    const { version } = z.object({ version: z.number().int().positive() }).parse(await request.json());
    const outcome = await applyImportBatch(projectId, userId, (await params).id, version);
    if (!outcome.applied) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "반영 직전 검증에서 오류가 발견되어 반영하지 않았습니다." }, data: outcome.view }, { status: 400 });
    return NextResponse.json({ data: outcome });
  } catch (error) { return importFailureResponse(error) ?? mutationErrorResponse(error); }
}
