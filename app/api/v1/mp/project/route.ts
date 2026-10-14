import { NextResponse } from "next/server";
import { z } from "zod";
import { listMpProjects, MP_PROJECT_COOKIE } from "@/lib/server/mp/context";

// 다중 프로젝트 메뉴(WBS2 등)의 선택 프로젝트 변경 — 로그인 세션은 그대로 두고 선택 쿠키만 바꾼다.
// 선택 가능 범위(로그인 프로젝트 + 하위 계층 중 소속)를 여기서 한 번, 이후 매 요청마다 컨텍스트에서 다시 검증한다.
export async function GET() {
  return NextResponse.json({ data: await listMpProjects() });
}

export async function PUT(request: Request) {
  const parsed = z.object({ projectId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "프로젝트를 선택해 주세요." } }, { status: 400 });
  const project = (await listMpProjects()).find((item) => item.id === parsed.data.projectId);
  if (!project) return NextResponse.json({ error: { code: "FORBIDDEN", message: "선택할 수 없는 프로젝트입니다." } }, { status: 403 });
  const response = NextResponse.json({ data: project });
  response.cookies.set(MP_PROJECT_COOKIE, project.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
