import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { setProjectAssignment } from "@/lib/server/projects-admin";
import { mutationErrorResponse } from "@/lib/server/http";

// 플랫폼 관리 → 프로젝트 관리: 프로젝트별 사용자 배정·해제 (슈퍼관리자 전용, 권한 검사는 서버 로직에서)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await setProjectAssignment(userId, id, await request.json()) });
  } catch (error) { return mutationErrorResponse(error); }
}
