import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";
import { DEFAULT_PROJECT_ID } from "@/lib/domain/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    const project = await prisma.project.findUnique({ where: { id: DEFAULT_PROJECT_ID } });
    if (!project) throw new Error("Default project is unavailable.");

    // 원격/사내 중앙 서버 DB의 메뉴 라벨 동기화 보장 ('업무일지' -> 'WBS상세내용')
    await prisma.menuPreference.updateMany({
      where: { menuKey: "work-logs", label: { not: "WBS상세내용" } },
      data: { label: "WBS상세내용" },
    });

    return NextResponse.json({
      status: "ok",
      database: "connected",
      provider: "postgres",
      version: "2026-09-18-wbs-new-menu-role-access",
    });
  } catch (error) {
    console.error("Postgres health check failed", error);
    return NextResponse.json({ status: "error", database: "unavailable", provider: "postgres" }, { status: 503 });
  }
}
