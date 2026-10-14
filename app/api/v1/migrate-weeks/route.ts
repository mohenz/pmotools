import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const prisma = getPrisma();
  
  try {
    // 1. 하위 프로젝트(parentId가 있는 프로젝트) 찾기
    const subProjects = await prisma.project.findMany({
      where: { parentId: { not: null } }
    });

    let migratedWeeks = 0;
    let migratedGroups = 0;
    const errors: string[] = [];

    for (const sp of subProjects) {
      // 최상위 프로젝트 아이디 찾기 (단순 1단계 부모라고 가정, 필요시 더 올라갈 수 있으나 보통 1단계임)
      let rootId = sp.parentId!;
      const parent = await prisma.project.findUnique({ where: { id: rootId } });
      if (parent?.parentId) {
        rootId = parent.parentId; // 최대 2단계까지만 체크
      }

      // 2. 업무그룹 마이그레이션은 타 기능(WBS 등) 영향을 고려하여 제외함.

      // 3. 주차(Week) 마이그레이션
      try {
        const weeks = await prisma.week.findMany({
          where: { projectId: sp.id }
        });
        for (const w of weeks) {
          // 중복 여부 체크 (최상위에 동일 weekKey가 있는지)
          const existing = await prisma.week.findUnique({
            where: { projectId_weekKey: { projectId: rootId, weekKey: w.weekKey } }
          });
          if (!existing) {
            await prisma.week.update({
              where: { id: w.id },
              data: { projectId: rootId }
            });
            migratedWeeks++;
          }
        }
      } catch (err: any) {
        errors.push(`위클리리포트 주차 마이그레이션 실패 (${sp.id}): ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "마이그레이션 완료",
      migratedWeeks,
      migratedGroups,
      errors
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
