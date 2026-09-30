import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { getPrisma } from "@/lib/server/db-pg";

const signupSchema = z.object({
  userId: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문/숫자/._- 만 사용할 수 있습니다."),
  name: z.string().trim().min(1).max(50),
  department: z.union([z.string().trim().max(100), z.literal("")]).optional(),
  password: z.string().min(8).max(100),
  projectCode: z.string().trim().min(1, "가입할 프로젝트를 선택해 주세요.").max(50),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." } }, { status: 400 });
  }

  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { code: parsed.data.projectCode } });
  if (!project) {
    return NextResponse.json({ error: { code: "PROJECT_NOT_FOUND", message: "존재하지 않는 프로젝트 코드입니다." } }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { userId: parsed.data.userId } });
  if (existing) {
    return NextResponse.json({ error: { code: "AUTH_DUPLICATE_ID", message: "이미 사용 중인 아이디입니다." } }, { status: 409 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { userId: parsed.data.userId, name: parsed.data.name, department: parsed.data.department || null, passwordHash, role: "MEMBER" },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: user.id, role: "MEMBER" },
  });

  return NextResponse.json({ data: { id: user.id, userId: user.userId } }, { status: 201 });
}
