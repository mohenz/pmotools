import { NextRequest, NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { updateUserProjects } from "@/lib/server/admin";
import { mutationErrorResponse } from "@/lib/server/http";

// 사용자별 프로젝트 배정 저장 — 관리자 이상(권한 검사는 서버 로직에서)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  try {
    return NextResponse.json({ data: await updateUserProjects(projectId, userId, id, await request.json()) });
  } catch (error) { return mutationErrorResponse(error); }
}
