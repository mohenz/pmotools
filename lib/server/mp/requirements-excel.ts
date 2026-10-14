// [WBS2 복사본] 원본: lib/server/requirements-excel.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import "server-only";
import ExcelJS from "exceljs";
import { getPrisma, actorNameOf, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { displayIdConflictMessage, type ImportFailureRow } from "@/lib/domain/mp/import-failure";
import { applyFailure, fileFailure } from "@/lib/server/mp/import-errors";
import { acceptanceLabels } from "@/lib/domain/requirements";
import type { RequirementAcceptance, Prisma } from "@/lib/generated/prisma/client";

type ParsedRequirementData = {
  requirementId: string | null; title: string;
  businessMajorCategory: string; businessMiddleCategory: string; businessMinorCategory: string;
  divisionCodeId: string | null; categoryCodeId: string | null; requestDepartment: string;
  priority: "low" | "medium" | "high" | null; importance: "low" | "medium" | "high" | null;
  acceptanceStatus: RequirementAcceptance; addedAfterConfirmation: boolean | null;
  content: string; precondition: string; resolution: string; basis: string; notes: string;
  registrationDate: Date | null; finalCheckNote: string; inspectionCriteria: string;
};

// 요구사항 ID(수기 코드)를 기준으로 파일 = 전체 목록이 되도록 동기화한다: 요구사항 ID가 기존과 일치하면 그 행의
// 내부 id를 유지한 채 갱신(변경이력 보존), 파일에 없는 기존 요구사항 ID는 삭제, 새로 나타난 것은 신규 생성한다.
// 요구사항 ID가 비어있는 행은 매칭 기준이 없어 항상 신규 생성으로 처리된다.
const HEADERS = ["요구사항 ID", "업무 대분류", "업무 중분류", "업무 소분류", "기능분류", "구분", "요구사항 명", "요구사항 상세설명", "사전 확인 사항", "요구사항 해결방안", "요구사항 출처", "요청부서/성명", "등록일자", "중요도", "우선순위", "수용여부", "최종 확인사항", "확정후추가", "비고", "검수 기준"] as const;
const PRIORITY_LABEL: Record<string, string> = { high: "상", medium: "중", low: "하" };
const PRIORITY_VALUE: Record<string, string> = { 상: "high", 중: "medium", 하: "low" };
const ACCEPTANCE_VALUE: Record<string, string> = Object.fromEntries(Object.entries(acceptanceLabels).map(([value, label]) => [label, value]));

export async function exportRequirementsToExcel(projectId: string): Promise<Buffer> {
  const requirements = await getPrisma().requirement.findMany({
    where: { projectId, archivedAt: null },
    include: { owner: { select: { userId: true } }, division: { select: { label: true } }, category: { select: { label: true } } },
    orderBy: { displayId: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("요구사항");
  sheet.addRow(HEADERS as unknown as string[]);
  sheet.getRow(1).font = { bold: true };
  for (const requirement of requirements) {
    sheet.addRow([
      requirement.requirementId ?? "",
      requirement.businessMajorCategory, requirement.businessMiddleCategory, requirement.businessMinorCategory,
      requirement.division?.label ?? "", requirement.category?.label ?? "",
      requirement.title, requirement.content, requirement.precondition, requirement.resolution, requirement.basis,
      requirement.requestDepartment,
      requirement.registrationDate ?? "",
      requirement.importance ? PRIORITY_LABEL[requirement.importance] : "", requirement.priority ? PRIORITY_LABEL[requirement.priority] : "",
      acceptanceLabels[requirement.acceptanceStatus],
      requirement.finalCheckNote,
      requirement.addedAfterConfirmation === null ? "" : requirement.addedAfterConfirmation ? "예" : "아니요",
      requirement.notes,
      requirement.inspectionCriteria,
    ]);
  }
  sheet.columns.forEach((col) => { col.width = 18; });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ImportRowResult = { row: number; action: "create" | "update"; title: string; errors: string[]; warnings: string[] };
export type ImportReport = { rows: ImportRowResult[]; validCount: number; errorCount: number; willDeleteCount: number };

async function parseAndValidate(projectId: string, buffer: Buffer): Promise<{ report: ImportReport; parsed: { row: number; matchId: string | null; data: ParsedRequirementData }[]; deleteIds: string[] }> {
  const workbook = new ExcelJS.Workbook();
  // 손상·암호·형식 오류 파일은 원인과 조치를 담은 상세 오류로 돌려준다(2026-09-30).
  try { await workbook.xlsx.load(buffer as unknown as ArrayBuffer); } catch (error) { throw fileFailure(error); }
  const sheet = workbook.worksheets[0];
  const prisma = getPrisma();

  const [existing, codes] = await Promise.all([
    prisma.requirement.findMany({ where: { projectId }, select: { id: true, requirementId: true } }),
    prisma.commonCode.findMany({ where: { projectId, groupCode: { in: ["requirement_division", "requirement_category"] }, isActive: true }, select: { id: true, groupCode: true, label: true } }),
  ]);
  const existingByRequirementId = new Map(existing.filter((r) => r.requirementId).map((r) => [r.requirementId as string, r.id]));
  const divisionByLabel = new Map(codes.filter((c) => c.groupCode === "requirement_division").map((c) => [c.label, c.id]));
  const categoryByLabel = new Map(codes.filter((c) => c.groupCode === "requirement_category").map((c) => [c.label, c.id]));
  const seenRequirementIds = new Map<string, number>();
  const matchedRequirementIds = new Set<string>();

  const rows: ImportRowResult[] = [];
  const parsed: { row: number; matchId: string | null; data: ParsedRequirementData }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cell = (index: number) => String(row.getCell(index).value ?? "").trim();
    const [requirementIdCell, majorCategory, middleCategory, minorCategory, divisionLabel, categoryLabel, title, content, precondition, resolution, basis, requestDepartment, registrationDateRaw, importanceLabel, priorityLabel, acceptanceLabel, finalCheckNote, addedAfterRaw, notes, inspectionCriteria] = HEADERS.map((_, i) => cell(i + 1));
    if (!title && !requirementIdCell) return; // skip fully blank rows

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!title) errors.push("요구사항명은 필수입니다.");
    if (title.length > 200) errors.push("요구사항명은 200자를 초과할 수 없습니다.");

    const matchId = requirementIdCell ? (existingByRequirementId.get(requirementIdCell) ?? null) : null;
    if (requirementIdCell) {
      const dupRow = seenRequirementIds.get(requirementIdCell);
      if (dupRow) errors.push(`요구사항 ID(${requirementIdCell})가 ${dupRow}행과 중복됩니다.`);
      seenRequirementIds.set(requirementIdCell, rowNumber);
      matchedRequirementIds.add(requirementIdCell);
    }

    let divisionCodeId: string | null = null;
    if (divisionLabel) { divisionCodeId = divisionByLabel.get(divisionLabel) ?? null; if (!divisionCodeId) errors.push(`기능분류(${divisionLabel})를 찾을 수 없습니다.`); }
    let categoryCodeId: string | null = null;
    if (categoryLabel) { categoryCodeId = categoryByLabel.get(categoryLabel) ?? null; if (!categoryCodeId) errors.push(`구분(${categoryLabel})을 찾을 수 없습니다.`); }

    let priority: "low" | "medium" | "high" | null = null;
    if (priorityLabel) { const value = PRIORITY_VALUE[priorityLabel]; if (!value) errors.push(`우선순위 값이 올바르지 않습니다(${priorityLabel}). 상/중/하 중 하나여야 합니다.`); else priority = value as "low" | "medium" | "high"; }
    let importance: "low" | "medium" | "high" | null = null;
    if (importanceLabel) { const value = PRIORITY_VALUE[importanceLabel]; if (!value) errors.push(`중요도 값이 올바르지 않습니다(${importanceLabel}). 상/중/하 중 하나여야 합니다.`); else importance = value as "low" | "medium" | "high"; }

    let acceptanceStatus: RequirementAcceptance = "pending";
    if (acceptanceLabel) { const value = ACCEPTANCE_VALUE[acceptanceLabel]; if (!value) errors.push(`수용여부 값이 올바르지 않습니다(${acceptanceLabel}). ${Object.values(acceptanceLabels).join("/")} 중 하나여야 합니다.`); else acceptanceStatus = value as RequirementAcceptance; }

    let addedAfterConfirmation: boolean | null = null;
    if (addedAfterRaw === "예") addedAfterConfirmation = true;
    else if (addedAfterRaw === "아니요") addedAfterConfirmation = false;
    else if (addedAfterRaw) errors.push(`확정후추가 값이 올바르지 않습니다(${addedAfterRaw}). 예/아니요 중 하나이거나 비워야 합니다.`);

    let registrationDate: Date | null = null;
    const registrationCellValue = row.getCell(13).value;
    if (registrationCellValue instanceof Date) registrationDate = registrationCellValue;
    else if (registrationDateRaw) {
      const parsedDate = new Date(registrationDateRaw);
      if (Number.isNaN(parsedDate.getTime())) errors.push(`등록일자 형식이 올바르지 않습니다(${registrationDateRaw}).`);
      else registrationDate = parsedDate;
    }

    for (const [label, value, max] of [["요구사항 상세설명", content, 10000], ["사전 확인 사항", precondition, 5000], ["요구사항 해결방안", resolution, 5000], ["요구사항 출처", basis, 5000], ["비고", notes, 5000], ["최종 확인사항", finalCheckNote, 5000], ["검수 기준", inspectionCriteria, 5000]] as const) {
      if (value.length > max) errors.push(`${label}은(는) ${max}자를 초과할 수 없습니다.`);
    }

    rows.push({ row: rowNumber, action: matchId ? "update" : "create", title: title || "(제목 없음)", errors, warnings });
    if (!errors.length) parsed.push({
      row: rowNumber, matchId,
      data: { requirementId: requirementIdCell || null, title, businessMajorCategory: majorCategory, businessMiddleCategory: middleCategory, businessMinorCategory: minorCategory, divisionCodeId, categoryCodeId, requestDepartment, priority, importance, acceptanceStatus, addedAfterConfirmation, content, precondition, resolution, basis, notes, registrationDate, finalCheckNote, inspectionCriteria },
    });
  });
  // 신규 요구사항에 발급될 표시 ID(REQ-)가 이미 쓰이면(순번 구간 미설정) 반영이 통째로 실패하므로 검증에서 행별로 미리 막는다(2026-09-30).
  const creates = parsed.filter((item) => !item.matchId);
  if (creates.length) {
    const sequence = (await prisma.requirementSequence.findUnique({ where: { projectId } }))?.value ?? 0;
    const planned = creates.map((item, index) => ({ row: item.row, displayId: plannedRequirementDisplayId(sequence + index + 1) }));
    const taken = await prisma.requirement.findMany({ where: { displayId: { in: planned.map((p) => p.displayId) } }, select: { displayId: true, project: { select: { code: true } } } });
    const ownerById = new Map(taken.map((item) => [item.displayId, item.project.code]));
    for (const plan of planned) if (ownerById.has(plan.displayId)) rows.find((r) => r.row === plan.row)?.errors.push(displayIdConflictMessage("requirement", plan.displayId, ownerById.get(plan.displayId) ?? null));
  }
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  // 파일에서 매칭되지 않은(=요구사항 ID가 없거나, 있어도 파일에 다시 나타나지 않은) 기존 요구사항은 삭제 대상이다.
  const deleteIds = existing.filter((r) => !r.requirementId || !matchedRequirementIds.has(r.requirementId)).map((r) => r.id);
  return { report: { rows, validCount: rows.length - errorCount, errorCount, willDeleteCount: deleteIds.length }, parsed, deleteIds };
}

const plannedRequirementDisplayId = (sequenceValue: number) => `REQ-${new Date().getUTCFullYear()}-${String(sequenceValue).padStart(6, "0")}`;

export async function validateRequirementsImport(projectId: string, buffer: Buffer): Promise<ImportReport> {
  const { report } = await parseAndValidate(projectId, buffer);
  return report;
}

// 요구사항 ID 매칭 동기화: 매칭되는 기존 요구사항은 id를 유지한 채 갱신(이력 보존), 매칭 안 된 기존 요구사항은 삭제,
// 새로 나타난 요구사항 ID(또는 요구사항 ID가 없는 행)는 신규 생성한다.
export async function applyRequirementsImport(projectId: string, userId: string, buffer: Buffer) {
  await assertManager(projectId, userId);
  const { report, parsed, deleteIds } = await parseAndValidate(projectId, buffer);
  if (report.errorCount > 0) return { applied: 0, created: 0, updated: 0, deleted: 0, report };

  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);
  let created = 0, updated = 0;

  // 반영 중 실패하면 어느 행에서 멈췄는지 상세 오류에 담는다(트랜잭션이라 전체 취소).
  let current: ImportFailureRow | null = null;
  try { await prisma.$transaction(async (tx) => {
    if (deleteIds.length) await tx.requirement.deleteMany({ where: { id: { in: deleteIds } } });
    for (const item of parsed) {
      current = { row: item.row, action: item.matchId ? "수정" : "신규", code: item.data.requirementId ?? undefined, name: item.data.title };
      if (item.matchId) {
        const before = await tx.requirement.findUniqueOrThrow({ where: { id: item.matchId } });
        const after = await tx.requirement.update({ where: { id: item.matchId }, data: { ...item.data, version: { increment: 1 } } });
        await tx.requirementEvent.create({ data: { requirementId: item.matchId, eventType: "edited", actorId: userId, actorName, body: "엑셀 일괄 동기화", beforeData: before as unknown as Prisma.InputJsonValue, afterData: after as unknown as Prisma.InputJsonValue } });
        updated += 1;
      } else {
        const sequence = await tx.requirementSequence.upsert({ where: { projectId }, create: { projectId, value: 1 }, update: { value: { increment: 1 } } });
        const displayId = plannedRequirementDisplayId(sequence.value);
        current = { ...current!, displayId };
        const requirement = await tx.requirement.create({ data: { displayId, projectId, createdBy: userId, ...item.data } });
        await tx.requirementEvent.create({ data: { requirementId: requirement.id, eventType: "created", actorId: userId, actorName, body: "엑셀 일괄 동기화" } });
        created += 1;
      }
    }
  }, { timeout: 60000 }); } catch (error) { throw applyFailure("requirement", error, current); }
  await writeAuditLog(projectId, userId, "REQUIREMENTS_EXCEL_IMPORT_SYNC", "requirements", projectId, null, { created, updated, deleted: deleteIds.length });
  return { applied: created + updated, created, updated, deleted: deleteIds.length, report };
}
