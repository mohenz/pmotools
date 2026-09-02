import "server-only";
import ExcelJS from "exceljs";
import { getPrisma, actorNameOf, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { acceptanceLabels } from "@/lib/domain/requirements";
import type { RequirementAcceptance } from "@/lib/generated/prisma/client";

type ParsedRequirementData = {
  requirementId: string | null; title: string;
  businessMajorCategory: string; businessMiddleCategory: string; businessMinorCategory: string;
  divisionCodeId: string | null; categoryCodeId: string | null; requestDepartment: string;
  priority: "low" | "medium" | "high" | null; importance: "low" | "medium" | "high" | null;
  acceptanceStatus: RequirementAcceptance; addedAfterConfirmation: boolean | null;
  content: string; precondition: string; resolution: string; basis: string; notes: string;
  registrationDate: Date | null; finalCheckNote: string; inspectionCriteria: string;
};

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

export type ImportRowResult = { row: number; action: "create"; title: string; errors: string[]; warnings: string[] };
export type ImportReport = { rows: ImportRowResult[]; validCount: number; errorCount: number };

async function parseAndValidate(projectId: string, buffer: Buffer): Promise<{ report: ImportReport; parsed: { row: number; data: ParsedRequirementData }[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const prisma = getPrisma();

  const codes = await prisma.commonCode.findMany({ where: { projectId, groupCode: { in: ["requirement_division", "requirement_category"] }, isActive: true }, select: { id: true, groupCode: true, label: true } });
  const divisionByLabel = new Map(codes.filter((c) => c.groupCode === "requirement_division").map((c) => [c.label, c.id]));
  const categoryByLabel = new Map(codes.filter((c) => c.groupCode === "requirement_category").map((c) => [c.label, c.id]));
  const seenRequirementIds = new Map<string, number>();

  const rows: ImportRowResult[] = [];
  const parsed: { row: number; data: ParsedRequirementData }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cell = (index: number) => String(row.getCell(index).value ?? "").trim();
    const [requirementIdCell, majorCategory, middleCategory, minorCategory, divisionLabel, categoryLabel, title, content, precondition, resolution, basis, requestDepartment, registrationDateRaw, importanceLabel, priorityLabel, acceptanceLabel, finalCheckNote, addedAfterRaw, notes, inspectionCriteria] = HEADERS.map((_, i) => cell(i + 1));
    if (!title && !requirementIdCell) return; // skip fully blank rows

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!title) errors.push("요구사항명은 필수입니다.");
    if (title.length > 200) errors.push("요구사항명은 200자를 초과할 수 없습니다.");

    if (requirementIdCell) {
      const dupRow = seenRequirementIds.get(requirementIdCell);
      if (dupRow) errors.push(`요구사항 ID(${requirementIdCell})가 ${dupRow}행과 중복됩니다.`);
      seenRequirementIds.set(requirementIdCell, rowNumber);
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

    rows.push({ row: rowNumber, action: "create", title: title || "(제목 없음)", errors, warnings });
    if (!errors.length) parsed.push({
      row: rowNumber,
      data: { requirementId: requirementIdCell || null, title, businessMajorCategory: majorCategory, businessMiddleCategory: middleCategory, businessMinorCategory: minorCategory, divisionCodeId, categoryCodeId, requestDepartment, priority, importance, acceptanceStatus, addedAfterConfirmation, content, precondition, resolution, basis, notes, registrationDate, finalCheckNote, inspectionCriteria },
    });
  });
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  return { report: { rows, validCount: rows.length - errorCount, errorCount }, parsed };
}

export async function validateRequirementsImport(projectId: string, buffer: Buffer): Promise<ImportReport> {
  const { report } = await parseAndValidate(projectId, buffer);
  return report;
}

// 엑셀 업로드 시 프로젝트의 기존 요구사항을 모두 삭제하고 업로드 파일 내용으로 초기화한다.
export async function applyRequirementsImport(projectId: string, userId: string, buffer: Buffer) {
  await assertManager(projectId, userId);
  const { report, parsed } = await parseAndValidate(projectId, buffer);
  if (report.errorCount > 0) return { applied: 0, deleted: 0, report };
  const prisma = getPrisma();
  const actorName = await actorNameOf(userId);

  const { applied, deleted } = await prisma.$transaction(async (tx) => {
    const { count: deleted } = await tx.requirement.deleteMany({ where: { projectId } });
    await tx.requirementSequence.deleteMany({ where: { projectId } });
    let applied = 0;
    for (const item of parsed) {
      applied += 1;
      const displayId = `REQ-${new Date().getUTCFullYear()}-${String(applied).padStart(6, "0")}`;
      const requirement = await tx.requirement.create({ data: { displayId, projectId, createdBy: userId, ...item.data } });
      await tx.requirementEvent.create({ data: { requirementId: requirement.id, eventType: "created", actorId: userId, actorName, body: "엑셀 초기화 후 일괄 등록" } });
    }
    if (applied > 0) await tx.requirementSequence.create({ data: { projectId, value: applied } });
    return { applied, deleted };
  }, { timeout: 60000 });

  await writeAuditLog(projectId, userId, "REQUIREMENTS_EXCEL_RESET_IMPORT", "requirements", projectId, { count: deleted }, { count: applied });
  return { applied, deleted, report };
}
