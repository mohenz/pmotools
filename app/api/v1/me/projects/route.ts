import { NextResponse } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { listAccessibleProjects } from "@/lib/server/project-access";

// 프로젝트 전환 목록 — 슈퍼관리자·관리자는 전체 프로젝트, 운영자·사용자는 배정된 프로젝트(노출 우선순위 → 이름순)
export async function GET() {
  const { userId } = await getLocalContext();
  return NextResponse.json({ data: await listAccessibleProjects(userId) });
}
