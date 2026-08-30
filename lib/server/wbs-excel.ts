import "server-only";
import ExcelJS from "exceljs";
import { revalidateTag } from "next/cache";
import { codeFromPath, levelOf, pathFromCode, sortKeyFromCode } from "@/lib/domain/wbs";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { assertManager } from "@/lib/server/permissions";
import { wbsTag } from "@/lib/server/cache-tags";
import { WBS_EXCEL_HEADERS, WBS_EXCEL_ROLE_NAMES, listWbsItemsExcelColumns, listWbsWorkGroups } from "@/lib/server/wbs";
import type { Prisma } from "@/lib/generated/prisma/client";

const HEADER_LIST: readonly string[] = WBS_EXCEL_HEADERS;
const col = (label: string) => HEADER_LIST.indexOf(label) + 1;

export async function exportWbsToExcel(projectId: string): Promise<Buffer> {
  const { rows } = await listWbsItemsExcelColumns(projectId, { pageSize: "all" });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("WBS");
  sheet.addRow([...WBS_EXCEL_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const item of rows) {
    sheet.addRow([
      item.level, sortKeyFromCode(item.code), item.projectCode, item.configStatus, item.stage ?? "", item.code, item.name, "",
      item.isLeaf ? 1 : "", item.ownerName ?? "", item.ownerLoginId ?? "", item.groupLabel ?? "", item.startDate ?? "", item.dueDate ?? "",
      item.deliverable?.note ?? "", item.deliverable?.isOfficial ? "Y" : "", item.deliverable?.fileUrl ?? "", item.sequenceNo,
      item.deliverable?.templateUrl ?? "", item.deliverable?.reviewerName ?? "", item.deliverable?.reviewedAt ?? "",
      item.workingDays ?? "", item.weight ?? item.workingDays ?? "", item.workingDays ?? "", Math.round(item.actualProgress * 100),
      ...item.roles.map((role) => (role.hasPermission ? 1 : "")),
      ...item.roles.map((role) => role.progressPercent),
      item.plannedProgress === null ? "" : Math.round(item.plannedProgress * 100),
      Math.round(item.actualProgress * 100),
      item.progressIndex === null ? "" : Math.round(item.progressIndex * 100),
    ]);
  }
  sheet.columns.forEach((column) => { column.width = 16; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export type WbsImportRowResult = { row: number; code: string; name: string; errors: string[]; warnings: string[] };
export type WbsImportReport = { rows: WbsImportRowResult[]; validCount: number; errorCount: number };

type ParsedWbsRow = {
  path: string; level: number; name: string; configStatus: string;
  ownerUserId: string | null; ownerNameRaw: string; ownerLoginId: string; groupId: string | null;
  startDate: string | null; dueDate: string | null; weight: number | null;
  deliverable: { note: string; isOfficial: boolean; fileUrl: string; templateUrl: string; reviewerUserId: string | null; reviewedAt: string | null } | null;
  assignments: { groupId: string; progressPercent: number }[];
};

// Stage(레벨1 조상 이름)가 이 값이고 담당자를 특정할 수 없을 때 기본으로 지정할 사용자ID.
// 2026-08-30 사용자 요청: "stage가 기획이면 담당자는 사용자 id q93w36(이승연)으로 매핑" — 파일에 사용자ID나
// R&R(실행)이 명시돼 있으면 그 값이 우선하고, 둘 다 비어 있을 때만 이 기본값을 적용한다.
const STAGE_DEFAULT_OWNER_LOGIN_ID: Record<string, string> = { "기획": "q93w36" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^\d+(\.\d+)*$/;

async function parseAndValidateWbsImport(projectId: string, buffer: Buffer): Promise<{ report: WbsImportReport; parsed: ParsedWbsRow[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  // 공휴일 등 다른 시트가 함께 들어있는 파일도 있어 A1 헤더("wbs_level")로 실제 WBS 시트를 찾고, 못 찾으면 첫 시트로 되돌아간다.
  const sheet = workbook.worksheets.find((candidate) => String(candidate.getRow(1).getCell(1).value ?? "").trim() === WBS_EXCEL_HEADERS[0]) ?? workbook.worksheets[0];
  const prisma = getPrisma();
  const [groups, members] = await Promise.all([
    listWbsWorkGroups(projectId),
    prisma.projectMember.findMany({ where: { projectId, isActive: true, user: { status: "ACTIVE" } }, include: { user: true } }),
  ]);
  const groupsByLabel = new Map(groups.map((group) => [group.label, group]));
  const membersByName = new Map<string, string[]>();
  const membersByLoginId = new Map(members.map((member) => [member.user.userId, member.user.id]));
  for (const member of members) {
    const ids = membersByName.get(member.user.name) ?? [];
    ids.push(member.user.id);
    membersByName.set(member.user.name, ids);
  }
  function resolveMember(name: string, fieldLabel: string, warnings: string[]): string | null {
    if (!name) return null;
    const ids = membersByName.get(name);
    if (!ids || ids.length === 0) { warnings.push(`${fieldLabel}(${name})를 찾을 수 없어 미지정 처리됩니다.`); return null; }
    if (ids.length > 1) { warnings.push(`${fieldLabel}(${name})가 여러 명이라 미지정 처리됩니다.`); return null; }
    return ids[0];
  }
  // 담당자(R&R 실행) 전용 — 사용자ID가 있으면 이름보다 우선하고, 둘 다 없으면 Stage 기본값을 적용한다.
  function resolveOwner(loginId: string, name: string, stage: string | null, warnings: string[]): string | null {
    if (loginId) {
      const id = membersByLoginId.get(loginId);
      if (id) return id;
      warnings.push(`사용자ID(${loginId})를 찾을 수 없어 이름으로 다시 확인합니다.`);
    }
    const byName = resolveMember(name, "담당자", warnings);
    if (byName) return byName;
    const defaultLoginId = stage ? STAGE_DEFAULT_OWNER_LOGIN_ID[stage] : undefined;
    if (defaultLoginId && !loginId && !name) {
      const id = membersByLoginId.get(defaultLoginId);
      if (id) return id;
      warnings.push(`Stage(${stage}) 기본 담당자(${defaultLoginId})를 프로젝트에서 찾을 수 없어 미지정 처리됩니다.`);
    }
    return null;
  }

  const rows: WbsImportRowResult[] = [];
  const parsed: ParsedWbsRow[] = [];
  const seenPaths = new Set<string>();
  // Stage(엑셀 E열) = 최상위(레벨1) 조상의 이름 — 상위 행이 하위 행보다 먼저 나온다는 기존 검증 규칙 덕분에
  // 행을 순서대로 훑으면서 "path의 첫 세그먼트 → 그 레벨1 행의 이름"만 기록해두면 매 행의 Stage를 즉석에서 구할 수 있다.
  const stageNameByRootPath = new Map<string, string>();
  // ExcelJS는 하이퍼링크 셀을 {text,hyperlink}, 리치텍스트를 {richText:[...]}, 수식을 {formula,result}로 반환한다.
  // String(value)로 바로 문자열화하면 이런 객체가 "[object Object]"로 저장되므로 실제 텍스트를 꺼내 쓴다.
  const cellText = (value: ExcelJS.CellValue): string => {
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
      if ("text" in value) { const text = String(value.text ?? "").trim(); return text || ("hyperlink" in value ? String(value.hyperlink ?? "") : ""); }
      if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
      if ("hyperlink" in value) return String(value.hyperlink ?? "");
      return "";
    }
    return String(value);
  };
  // 원본 엑셀은 우리 스키마(WBS_EXCEL_HEADERS)에 없는 빈 스페이서 열이 중간에 섞여 있을 수 있어(예: DueDate와
  // Deliverables 사이) 컬럼 순번 고정 매핑(col())은 위험하다 — 파일 자체의 1행 헤더 텍스트로 열 위치를 찾는다.
  // 리치텍스트로 줄바꿈이 섞여 들어오는 헤더도 있어 공백을 전부 제거하고 비교한다.
  const norm = (s: string) => s.replace(/\s+/g, "");
  const headerIndexByText = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, idx) => { const text = norm(cellText(cell.value)); if (text) headerIndexByText.set(text, idx); });
  const col = (label: string) => headerIndexByText.get(norm(label)) ?? (HEADER_LIST.indexOf(label) + 1);
  const cellAt = (row: ExcelJS.Row, label: string) => cellText(row.getCell(col(label)).value).trim();

  const formatUtcDate = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  // 엑셀에서 직접 편집한 파일은 셀 값이 "YYYY-MM-DD" 텍스트가 아니라 실제 Date, 엑셀 일련번호(숫자),
  // 또는 "-"/"."/"/" 구분자에 자릿수가 다른 문자열("2026.7.20" 등)로 들어오는 경우가 많아 최대한 폭넓게 처리한다.
  const cellDateAt = (row: ExcelJS.Row, label: string) => {
    const raw = row.getCell(col(label)).value;
    if (raw instanceof Date) return formatUtcDate(raw);
    if (raw && typeof raw === "object" && "result" in raw) {
      const result = (raw as { result: unknown }).result;
      if (result instanceof Date) return formatUtcDate(result);
      if (typeof result === "number") return formatUtcDate(new Date(Date.UTC(1899, 11, 30) + result * 86_400_000));
    }
    if (typeof raw === "number") return formatUtcDate(new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000));
    const text = String(raw ?? "").trim();
    const match = text.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    return text;
  };

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = cellAt(row, "Task");
    const name = cellAt(row, "Task Description");
    if (!code && !name) return; // 완전히 빈 행은 건너뛴다.

    const errors: string[] = [];
    const warnings: string[] = [];
    const codeValid = CODE_RE.test(code);
    if (!codeValid) errors.push(`Task 코드 형식이 올바르지 않습니다(${code || "빈 값"}).`);
    if (!name) errors.push("Task Description은 필수입니다.");

    const path = codeValid ? pathFromCode(code) : "";
    let stage: string | null = null;
    if (path) {
      if (seenPaths.has(path)) errors.push(`Task 코드가 중복됩니다(${code}).`);
      const level = levelOf(path);
      if (level > 1) {
        const parentPath = path.split(".").slice(0, -1).join(".");
        if (!seenPaths.has(parentPath)) errors.push(`상위 Task(${codeFromPath(parentPath)})에 해당하는 행이 이 행보다 앞에 있어야 합니다.`);
      }
      seenPaths.add(path);
      const rootPath = path.split(".")[0];
      if (level === 1) { stage = name; stageNameByRootPath.set(rootPath, name); }
      else stage = stageNameByRootPath.get(rootPath) ?? null;
    }

    const startDate = cellDateAt(row, "StartDate");
    const dueDate = cellDateAt(row, "DueDate");
    if (startDate && !DATE_RE.test(startDate)) errors.push("StartDate 형식이 올바르지 않습니다(YYYY-MM-DD).");
    if (dueDate && !DATE_RE.test(dueDate)) errors.push("DueDate 형식이 올바르지 않습니다(YYYY-MM-DD).");

    const weightRaw = cellAt(row, "가중치(입력불필요)");
    const weight = weightRaw ? Number(weightRaw) : null;
    if (weightRaw && !Number.isFinite(weight)) errors.push("가중치는 숫자여야 합니다.");

    const ownerName = cellAt(row, "R&R(실행)");
    const ownerLoginId = cellAt(row, "사용자ID");
    const ownerUserId = resolveOwner(ownerLoginId, ownerName, stage, warnings);
    const trackLabel = cellAt(row, "R&R(지원)(모듈)");
    let groupId: string | null = null;
    if (trackLabel) {
      const group = groupsByLabel.get(trackLabel);
      if (!group) warnings.push(`Track(${trackLabel})을 찾을 수 없어 미지정 처리됩니다.`);
      else groupId = group.id;
    }

    const note = cellAt(row, "Deliverables(이슈 및 사유)");
    const isOfficial = cellAt(row, "공식여부(입력불필요)") === "Y";
    const fileUrl = cellAt(row, "파일위치(입력불필요)");
    const templateUrl = cellAt(row, "산출물템플릿(입력불필요)");
    const reviewerName = cellAt(row, "검수자(입력불필요)");
    const reviewerUserId = resolveMember(reviewerName, "검수자", warnings);
    const reviewedAt = cellDateAt(row, "검수실행일(입력불필요)");
    if (reviewedAt && !DATE_RE.test(reviewedAt)) errors.push("검수실행일 형식이 올바르지 않습니다(YYYY-MM-DD).");
    const hasDeliverable = Boolean(note || isOfficial || fileUrl || templateUrl || reviewerName || reviewedAt);

    const assignments: { groupId: string; progressPercent: number }[] = [];
    for (const role of WBS_EXCEL_ROLE_NAMES) {
      const hasPermission = cellAt(row, `${role}(진척등록권한)`) === "1";
      const pctRaw = cellAt(row, `${role}(진도율)`);
      const percent = pctRaw ? Number(pctRaw) : 0;
      if (pctRaw && !Number.isFinite(percent)) errors.push(`${role} 진도율은 숫자여야 합니다.`);
      if (hasPermission) {
        const group = groupsByLabel.get(role);
        if (!group) warnings.push(`역할(${role})에 해당하는 Track이 없어 진척권한을 반영하지 못했습니다.`);
        else assignments.push({ groupId: group.id, progressPercent: Math.min(100, Math.max(0, Math.round(percent))) });
      }
    }

    rows.push({ row: rowNumber, code, name: name || "(이름 없음)", errors, warnings });
    if (!errors.length && path) parsed.push({
      path, level: levelOf(path), name, configStatus: cellAt(row, "Confing Status"),
      ownerUserId, ownerNameRaw: ownerName, ownerLoginId, groupId, startDate: startDate || null, dueDate: dueDate || null, weight,
      deliverable: hasDeliverable ? { note, isOfficial, fileUrl, templateUrl, reviewerUserId, reviewedAt: reviewedAt || null } : null,
      assignments,
    });
  });

  const errorCount = rows.filter((row) => row.errors.length > 0).length;
  return { report: { rows, validCount: rows.length - errorCount, errorCount }, parsed };
}

export async function validateWbsImport(projectId: string, buffer: Buffer): Promise<WbsImportReport> {
  const { report } = await parseAndValidateWbsImport(projectId, buffer);
  return report;
}

// 전체 교체 — 기존 WBS 데이터를 지우고 업로드 파일 내용으로 새로 만든다(병합/upsert 아님).
export async function applyWbsImport(projectId: string, userId: string, buffer: Buffer) {
  await assertManager(projectId, userId);
  const { report, parsed } = await parseAndValidateWbsImport(projectId, buffer);
  if (report.errorCount > 0) return { imported: 0, report };

  const prisma = getPrisma();
  const sorted = [...parsed].sort((a, b) => a.path.localeCompare(b.path));
  const year = new Date().getUTCFullYear();
  const idByPath = new Map<string, string>();
  const itemRows: Prisma.WbsItemCreateManyInput[] = [];
  const assignmentRows: Prisma.WbsAssignmentCreateManyInput[] = [];
  const deliverableRows: Prisma.WbsDeliverableCreateManyInput[] = [];

  sorted.forEach((row, index) => {
    const id = crypto.randomUUID();
    idByPath.set(row.path, id);
    const parentPath = row.level > 1 ? row.path.split(".").slice(0, -1).join(".") : null;
    const parentId = parentPath ? (idByPath.get(parentPath) ?? null) : null;
    itemRows.push({
      id, displayId: `WBS-${year}-${String(index + 1).padStart(6, "0")}`, projectId, parentId,
      path: row.path, level: row.level, name: row.name, description: "",
      ownerUserId: row.ownerUserId, ownerNameRaw: row.ownerUserId ? "" : row.ownerNameRaw, ownerLoginId: row.ownerUserId ? "" : row.ownerLoginId, groupId: row.groupId,
      startDate: row.startDate ? new Date(row.startDate) : null, dueDate: row.dueDate ? new Date(row.dueDate) : null,
      status: "not_started", configStatus: row.configStatus, weight: row.weight ?? null, createdBy: userId,
    });
    for (const assignment of row.assignments) assignmentRows.push({ wbsItemId: id, groupId: assignment.groupId, progressPercent: assignment.progressPercent, updatedBy: userId });
    if (row.deliverable) deliverableRows.push({
      wbsItemId: id, note: row.deliverable.note, isOfficial: row.deliverable.isOfficial,
      fileUrl: row.deliverable.fileUrl, templateUrl: row.deliverable.templateUrl,
      reviewerUserId: row.deliverable.reviewerUserId, reviewedAt: row.deliverable.reviewedAt ? new Date(row.deliverable.reviewedAt) : null,
    });
  });

  await prisma.$transaction(async (tx) => {
    await tx.wbsItem.deleteMany({ where: { projectId } });
    if (itemRows.length) await tx.wbsItem.createMany({ data: itemRows });
    if (assignmentRows.length) await tx.wbsAssignment.createMany({ data: assignmentRows });
    if (deliverableRows.length) await tx.wbsDeliverable.createMany({ data: deliverableRows });
    await tx.wbsItemSequence.upsert({ where: { projectId }, create: { projectId, value: itemRows.length }, update: { value: itemRows.length } });
  });
  await writeAuditLog(projectId, userId, "WBS_EXCEL_IMPORT_REPLACE", "wbs_items", projectId, null, { importedCount: itemRows.length });
  revalidateTag(wbsTag(projectId));
  return { imported: itemRows.length, report };
}
