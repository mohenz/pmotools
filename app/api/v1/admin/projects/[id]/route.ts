import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getLocalContext } from "@/lib/server/context";
import { updateProjectInfoAsAdmin } from "@/lib/server/projects-admin";
import { mutationErrorResponse } from "@/lib/server/http";

// 플랫폼 관리 → 프로젝트 관리: 임의 프로젝트 정보 수정 (플랫폼 슈퍼관리자 전용, 권한 검사는 서버 로직에서)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await getLocalContext();
  try {
    const data = await updateProjectInfoAsAdmin(userId, id, await request.json());
    revalidateTag("login-data");
    return NextResponse.json({ data });
  } catch (error) { return mutationErrorResponse(error); }
}
