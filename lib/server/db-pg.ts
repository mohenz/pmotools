import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { pmoPrisma?: PrismaClient };

function createPrismaClient() {
  const raw = process.env.POSTGRES_PRISMA_URL;
  if (!raw) throw new Error("POSTGRES_PRISMA_URL is not set.");
  // Supabase pooler 인증서가 Node 기본 신뢰 저장소에서 검증되지 않아 sslmode를 no-verify로 낮춘다(전송은 여전히 암호화됨).
  const connectionString = raw.replace(/sslmode=require/, "sslmode=no-verify");
  const adapter = new PrismaPg({ connectionString });
  // Supabase PgBouncer(transaction pooling) 하에서 커넥션 확보가 지연될 때 기본값(2s/5s)보다 여유를 둔다.
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000, timeout: 15_000 } });
}

export function getPrisma() {
  globalForPrisma.pmoPrisma ??= createPrismaClient();
  return globalForPrisma.pmoPrisma;
}

export function nowIso() {
  return new Date().toISOString();
}

export function businessDaysSince(value: string | Date) {
  const start = new Date(value);
  const end = new Date();
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  let count = 0;
  for (const cursor = new Date(start.getTime() + 86_400_000); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export async function writeAuditLog(
  projectId: string,
  actorId: string | null,
  action: string,
  targetTable: string | null,
  targetId: string | null,
  beforeData: Prisma.InputJsonValue | null,
  afterData: Prisma.InputJsonValue | null,
) {
  const prisma = getPrisma();
  const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null;
  return prisma.auditLog.create({
    data: {
      projectId,
      actorId,
      actorName: actor?.name ?? null,
      action,
      targetTable,
      targetId,
      beforeData: beforeData ?? undefined,
      afterData: afterData ?? undefined,
    },
  });
}
