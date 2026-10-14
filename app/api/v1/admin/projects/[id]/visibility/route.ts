import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { auth } from "@/lib/server/auth";

const schema = z.object({ isPublic: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (user?.role !== "SUPER_ADMIN") return NextResponse.json({ error: { message: "권한이 없습니다." } }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "잘못된 요청입니다." } }, { status: 400 });

  const prisma = getPrisma();
  await prisma.$executeRaw`UPDATE projects SET "isPublic" = ${parsed.data.isPublic} WHERE id = ${id}`;
  
  await writeAuditLog(id, user.id, "PROJECT_VISIBILITY_UPDATE", "projects", id, null, { isPublic: parsed.data.isPublic });
  revalidateTag("login-data");
  return NextResponse.json({ data: { success: true } });
}
