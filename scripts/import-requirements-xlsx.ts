import path from "node:path";
import ExcelJS from "exceljs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../lib/generated/prisma/client";

const args = process.argv.slice(2);
const useProcessEnv = args.includes("--use-process-env");

if (!useProcessEnv) {
  config({ path: ".env" });
  config({ path: ".env.local", override: true });
}

const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const sourceArg = args.find((arg) => arg !== "--use-process-env");
const sourcePath = path.resolve(sourceArg ?? "D:/Workspace/work/요구사항리스트_등록용.xlsx");
const rawConnectionString = useProcessEnv
  ? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;
const connectionString = rawConnectionString?.replace(/sslmode=require/, "sslmode=no-verify");
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const levelMap = { 상: "high", 중: "medium", 하: "low" } as const;
const acceptanceMap = { 수용: "accepted", 부분수용: "partially_accepted", 미수용: "rejected" } as const;
type ImportRow = {
  sourceRow: number;
  requirementId: string;
  businessMajorCategory: string;
  businessMiddleCategory: string;
  businessMinorCategory: string;
  divisionLabel: string;
  categoryLabel: string;
  title: string;
  content: string;
  precondition: string;
  resolution: string;
  basis: string;
  requestDepartment: string;
  registeredAt: Date;
  importance: (typeof levelMap)[keyof typeof levelMap];
  priority: (typeof levelMap)[keyof typeof levelMap];
  acceptanceStatus: (typeof acceptanceMap)[keyof typeof acceptanceMap];
  addedAfterConfirmation: boolean | null;
  notes: string;
};

function text(row: ExcelJS.Row, column: number) {
  return row.getCell(column).text.trim();
}

function dateValue(row: ExcelJS.Row, column: number) {
  const value = row.getCell(column).value;
  if (value instanceof Date) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86_400_000);
  }
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${row.number}행 등록일자를 해석할 수 없습니다.`);
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function nullableBoolean(value: string) {
  if (!value) return null;
  if (["예", "Y", "TRUE", "1"].includes(value.toUpperCase())) return true;
  if (["아니요", "N", "FALSE", "0"].includes(value.toUpperCase())) return false;
  throw new Error(`확정후추가 값 '${value}'을 해석할 수 없습니다.`);
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  const sheet = workbook.getWorksheet("Sheet1");
  if (!sheet) throw new Error("Sheet1을 찾을 수 없습니다.");

  const rows: ImportRow[] = [];
  for (let index = 2; index <= sheet.rowCount; index += 1) {
    const row = sheet.getRow(index);
    if (!text(row, 1) && !text(row, 7)) continue;
    if (text(row, 17) || text(row, 20)) throw new Error(`${index}행의 최종 확인사항 또는 검수 기준은 현재 시스템에 대응 필드가 없습니다.`);
    const importance = levelMap[text(row, 14) as keyof typeof levelMap];
    const priority = levelMap[text(row, 15) as keyof typeof levelMap];
    const acceptanceStatus = acceptanceMap[text(row, 16) as keyof typeof acceptanceMap];
    if (!importance || !priority || !acceptanceStatus) throw new Error(`${index}행의 중요도·우선순위·수용여부 값을 확인해 주세요.`);
    rows.push({
      sourceRow: index,
      requirementId: text(row, 1),
      businessMajorCategory: text(row, 2),
      businessMiddleCategory: text(row, 3),
      businessMinorCategory: text(row, 4),
      divisionLabel: text(row, 5),
      categoryLabel: text(row, 6),
      title: text(row, 7),
      content: text(row, 8),
      precondition: text(row, 9),
      resolution: text(row, 10),
      basis: text(row, 11),
      requestDepartment: text(row, 12),
      registeredAt: dateValue(row, 13),
      importance,
      priority,
      acceptanceStatus,
      addedAfterConfirmation: nullableBoolean(text(row, 18)),
      notes: text(row, 19),
    });
  }
  if (rows.length !== 171) throw new Error(`등록 대상은 171건이어야 하나 ${rows.length}건입니다.`);
  const ids = rows.map((row) => row.requirementId);
  if (ids.some((id) => !id)) throw new Error("요구사항 ID가 비어 있는 행이 있습니다.");
  if (new Set(ids).size !== ids.length) throw new Error("파일 안에 중복 요구사항 ID가 있습니다.");
  if (rows.some((row) => !row.title)) throw new Error("요구사항명이 비어 있는 행이 있습니다.");

  const codes = await prisma.commonCode.findMany({
    where: { projectId: PROJECT_ID, groupCode: { in: ["requirement_division", "requirement_category"] }, isActive: true },
  });
  const codeId = new Map(codes.map((code) => [`${code.groupCode}:${code.label}`, code.id]));
  for (const row of rows) {
    if (!codeId.has(`requirement_division:${row.divisionLabel}`)) throw new Error(`${row.sourceRow}행 기능구분 '${row.divisionLabel}' 공통코드가 없습니다.`);
    if (!codeId.has(`requirement_category:${row.categoryLabel}`)) throw new Error(`${row.sourceRow}행 구분 '${row.categoryLabel}' 공통코드가 없습니다.`);
  }

  const existing = await prisma.requirement.findMany({ where: { projectId: PROJECT_ID, requirementId: { in: ids } }, select: { requirementId: true } });
  if (existing.length) throw new Error(`이미 등록된 요구사항 ID가 있습니다: ${existing.map((row) => row.requirementId).join(", ")}`);
  const admin = await prisma.projectMember.findFirst({
    where: { projectId: PROJECT_ID, role: "ADMIN", isActive: true, user: { status: "ACTIVE", deletedAt: null } },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("등록 이력을 남길 활성 관리자 계정이 없습니다.");

  const result = await prisma.$transaction(async (tx) => {
    const sequence = await tx.requirementSequence.findUnique({ where: { projectId: PROJECT_ID } });
    const base = sequence?.value ?? 0;
    for (const [offset, row] of rows.entries()) {
      const displayId = `REQ-${row.registeredAt.getUTCFullYear()}-${String(base + offset + 1).padStart(6, "0")}`;
      const created = await tx.requirement.create({
        data: {
          displayId,
          requirementId: row.requirementId,
          projectId: PROJECT_ID,
          title: row.title,
          content: row.content,
          basis: row.basis,
          precondition: row.precondition,
          resolution: row.resolution,
          businessMajorCategory: row.businessMajorCategory,
          businessMiddleCategory: row.businessMiddleCategory,
          businessMinorCategory: row.businessMinorCategory,
          addedAfterConfirmation: row.addedAfterConfirmation,
          notes: row.notes,
          acceptanceStatus: row.acceptanceStatus,
          requestDepartment: row.requestDepartment,
          divisionCodeId: codeId.get(`requirement_division:${row.divisionLabel}`)!,
          categoryCodeId: codeId.get(`requirement_category:${row.categoryLabel}`)!,
          priority: row.priority,
          importance: row.importance,
          createdBy: admin.userId,
          createdAt: row.registeredAt,
          updatedAt: row.registeredAt,
        },
      });
      await tx.requirementEvent.create({
        data: { requirementId: created.id, eventType: "created", actorId: admin.userId, actorName: admin.user.name, body: "엑셀 일괄 등록", createdAt: row.registeredAt },
      });
    }
    await tx.requirementSequence.upsert({
      where: { projectId: PROJECT_ID },
      create: { projectId: PROJECT_ID, value: base + rows.length },
      update: { value: base + rows.length },
    });
    await tx.auditLog.create({
      data: {
        projectId: PROJECT_ID,
        actorId: admin.userId,
        actorName: admin.user.name,
        action: "REQUIREMENT_BULK_IMPORT",
        targetTable: "requirements",
        afterData: { source: path.basename(sourcePath), count: rows.length } satisfies Prisma.InputJsonValue,
      },
    });
    return { count: rows.length, firstDisplayId: `REQ-2026-${String(base + 1).padStart(6, "0")}`, lastDisplayId: `REQ-2026-${String(base + rows.length).padStart(6, "0")}` };
  }, { maxWait: 10_000, timeout: 120_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log(JSON.stringify(result));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
