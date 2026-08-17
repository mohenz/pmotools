import "server-only";
import { z } from "zod";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertAdmin } from "@/lib/server/permissions";
import { DomainError } from "@/lib/server/errors";

export type PasswordResetRequestRow = { id: string; userId: string; name: string; note: string | null; createdAt: string };

const createSchema = z.object({
  userId: z.string().trim().min(1).max(50),
  note: z.union([z.string().trim().max(200), z.literal("")]).optional(),
});

export async function createPasswordResetRequest(input: unknown) {
  const data = createSchema.parse(input);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { userId: data.userId } });
  if (!user) return; // 계정 존재 여부를 노출하지 않기 위해 조용히 종료합니다.
  const existing = await prisma.passwordResetRequest.findFirst({ where: { userId: user.id, status: "PENDING" } });
  if (existing) return;
  await prisma.passwordResetRequest.create({ data: { userId: user.id, note: data.note || null } });
}

export async function listPendingPasswordResetRequests(projectId: string, adminUserId: string): Promise<PasswordResetRequestRow[]> {
  await assertAdmin(projectId, adminUserId);
  const requests = await getPrisma().passwordResetRequest.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return requests.map((request) => ({ id: request.id, userId: request.user.userId, name: request.user.name, note: request.note, createdAt: request.createdAt.toISOString() }));
}

export async function resolvePasswordResetRequest(projectId: string, adminUserId: string, requestId: string) {
  await assertAdmin(projectId, adminUserId);
  const prisma = getPrisma();
  const request = await prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new DomainError("NOT_FOUND", "요청을 찾을 수 없습니다.");
  if (request.status !== "PENDING") throw new DomainError("INVALID_STATE", "이미 처리된 요청입니다.");
  const updated = await prisma.passwordResetRequest.update({ where: { id: requestId }, data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: adminUserId } });
  await writeAuditLog(projectId, adminUserId, "PASSWORD_RESET_REQUEST_RESOLVE", "password_reset_requests", requestId, request, updated);
  return { id: requestId };
}
