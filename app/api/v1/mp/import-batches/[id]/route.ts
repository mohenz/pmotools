import { NextResponse } from "next/server";
import { assertMpWritableProject } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { cancelImportBatch } from "@/lib/server/mp/import-staging";

type RouteContext = { params: Promise<{ id: string }> };

// 임시 배치 취소(삭제) — 올린 사람만
export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, userId } = await assertMpWritableProject();
    return NextResponse.json({ data: await cancelImportBatch(projectId, userId, (await params).id) });
  } catch (error) { return mutationErrorResponse(error); }
}
