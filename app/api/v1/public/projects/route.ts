import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db-pg";

export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = getPrisma();
  
  // 런타임에 isPublic 컬럼이 없을 경우를 대비한 방어 코드
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;`);
  } catch (e) {
    console.error("DB Column add failed:", e);
  }

  let projects;
  try {
    projects = await prisma.$queryRaw<{ code: string; name: string }[]>`SELECT code, name FROM projects WHERE "isPublic" = true ORDER BY "sortOrder" ASC, name ASC`;
  } catch (e) {
    projects = await prisma.$queryRaw<{ code: string; name: string }[]>`SELECT code, name FROM projects ORDER BY "sortOrder" ASC, name ASC`;
  }

  return NextResponse.json({ data: projects }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
