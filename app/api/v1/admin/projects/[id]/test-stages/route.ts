import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { createTestStage, listTestStages, saveTestStageLocks } from "@/lib/server/mp/defects/stages";

// 플랫폼 관리 → 프로젝트 관리: 결함 테스트 단계 등록·잠금 (슈퍼관리자 전용, 권한 검사는 서버 로직에서)
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { userId } = await getLocalContext();
    return NextResponse.json({ data: await listTestStages(userId, id) });
  } catch (error) { return mutationErrorResponse(error); }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { userId } = await getLocalContext();
    return NextResponse.json({ data: await createTestStage(userId, id, await request.json().catch(() => ({}))) }, { status: 201 });
  } catch (error) { return mutationErrorResponse(error); }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { userId } = await getLocalContext();
    return NextResponse.json({ data: await saveTestStageLocks(userId, id, await request.json().catch(() => ({}))) });
  } catch (error) { return mutationErrorResponse(error); }
}
