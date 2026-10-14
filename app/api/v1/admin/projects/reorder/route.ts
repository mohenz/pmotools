import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getLocalContext } from "@/lib/server/context";
import { reorderProjects } from "@/lib/server/projects-admin";
import { mutationErrorResponse } from "@/lib/server/http";

// 플랫폼 관리 → 프로젝트 관리: 전체 프로젝트 노출 우선순위 저장 (플랫폼 슈퍼관리자 전용, 권한 검사는 서버 로직에서)
export async function PATCH(request: NextRequest) {
  const { userId } = await getLocalContext();
  try {
    const { orderedIds } = await request.json();
    await reorderProjects(userId, orderedIds);
    revalidateTag("login-data");
    return NextResponse.json({ data: { ok: true } });
  } catch (error) { return mutationErrorResponse(error); }
}
