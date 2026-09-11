import "server-only";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { pmoPrisma?: PrismaClient };

function createPrismaClient() {
  const raw = process.env.VERCEL === "1"
    ? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  
  const isLocal = raw.includes("localhost") || raw.includes("127.0.0.1");
  // Supabase pooler 등 원격 접속 시 인증서 검증 문제를 해결하기 위해 ssl 옵션을 부여합니다. 로컬은 제외.
  const pool = new Pool({
    connectionString: raw,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  const adapter = new PrismaPg(pool);
  
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


// 이벤트/감사로그의 actorName은 "사건 발생 시점의 이름" 스냅샷이므로 기록 시점에 조회해 함께 저장한다.
export async function actorNameOf(actorId: string | null) {
  if (!actorId) return null;
  const actor = await getPrisma().user.findUnique({ where: { id: actorId }, select: { name: true } });
  return actor?.name ?? null;
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
  return prisma.auditLog.create({
    data: {
      projectId,
      actorId,
      actorName: await actorNameOf(actorId),
      action,
      targetTable,
      targetId,
      beforeData: beforeData ?? undefined,
      afterData: afterData ?? undefined,
    },
  });
}
