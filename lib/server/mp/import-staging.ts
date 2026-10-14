import "server-only";

import ExcelJS from "exceljs";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import { acceptanceLabels } from "@/lib/domain/requirements";
import { canApplyStaging, isBlankRow, mapReportToRows, normalizeCellValue, patchCells, stagingSummary, type ReportRow, type StagedCell, type StagedRowStatus, type StagingSummary } from "@/lib/domain/mp/import-staging";
import { getPrisma, writeAuditLog } from "@/lib/server/db-pg";
import { DomainError } from "@/lib/server/errors";
import { assertManager } from "@/lib/server/permissions";
import { listProjectMembers } from "@/lib/server/users";
import { fileFailure } from "@/lib/server/mp/import-errors";
import { WBS_EXCEL_HEADERS, listWbsWorkGroups } from "@/lib/server/mp/wbs";
import { applyWbsImport, validateWbsImport, type WbsImportApplyResult } from "@/lib/server/mp/wbs-excel";
import { applyRequirementsImport, validateRequirementsImport } from "@/lib/server/mp/requirements-excel";
import { listRequirementCodeOptions } from "@/lib/server/mp/requirements";

// ---------------------------------------------------------------------------
// 엑셀 업로드 임시 저장(스테이징) — WBS2 · 요구사항관리2 (2026-09-30 결정)
//   업로드 → 임시 저장 + 검증 → 오류 행만 화면 수정(저장마다 배치 전체 재검증) → 반영 시 배치 삭제.
//   검증·반영은 임시 데이터로 엑셀을 메모리에서 다시 만들어 기존 validate*/apply* 함수에 넣는다(규칙 단일화).
//   (프로젝트, 종류, 올린 사람)당 배치 1개, 올린 사람만 접근.
// ---------------------------------------------------------------------------

export type ImportKind = "WBS" | "REQUIREMENT";
export const IMPORT_KINDS: ImportKind[] = ["WBS", "REQUIREMENT"];

type Engine = {
  sheetName: string;
  keyHeaders: string[]; // 목록에 보여 줄 식별 열
  dateHeaders: string[]; // 수정 대화상자에서 날짜 입력으로 받을 열
  pickSheet: (workbook: ExcelJS.Workbook) => ExcelJS.Worksheet | undefined;
  validate: (projectId: string, buffer: Buffer) => Promise<{ rows: ReportRow[]; extra: Pick<StagingSummary, "actionCounts" | "willDeleteCount"> }>;
  apply: (projectId: string, userId: string, buffer: Buffer) => Promise<{ ok: true; result: unknown } | { ok: false; rows: ReportRow[]; extra: Pick<StagingSummary, "actionCounts" | "willDeleteCount"> }>;
  options: (projectId: string) => Promise<Record<string, string[]>>;
};

const ENGINES: Record<ImportKind, Engine> = {
  WBS: {
    sheetName: "WBS",
    keyHeaders: ["작업구분", "Task", "Task Description"],
    dateHeaders: ["StartDate", "DueDate", "실적시작일", "실적종료일", "검수실행일(입력불필요)"],
    // 기존 검증과 같은 규칙 — A1/B1 헤더가 wbs_level인 시트, 없으면 첫 시트
    pickSheet: (workbook) => workbook.worksheets.find((sheet) => [sheet.getRow(1).getCell(1).value, sheet.getRow(1).getCell(2).value].some((v) => String(v ?? "").trim() === WBS_EXCEL_HEADERS[0])) ?? workbook.worksheets[0],
    validate: async (projectId, buffer) => {
      const report = await validateWbsImport(projectId, buffer);
      return { rows: report.rows, extra: { actionCounts: report.actionCounts } };
    },
    apply: async (projectId, userId, buffer) => {
      const outcome = await applyWbsImport(projectId, userId, buffer);
      return outcome.result ? { ok: true, result: outcome.result } : { ok: false, rows: outcome.report.rows, extra: { actionCounts: outcome.report.actionCounts } };
    },
    options: async (projectId) => {
      const [groups, members] = await Promise.all([listWbsWorkGroups(projectId), listProjectMembers(projectId)]);
      return {
        "작업구분": ["D", "U", "I"],
        TRACK: groups.map((group) => group.label),
        "R&R(실행)": members.map((member) => member.name),
        "사용자ID": members.map((member) => member.userId).filter(Boolean),
      };
    },
  },
  REQUIREMENT: {
    sheetName: "요구사항",
    keyHeaders: ["요구사항 ID", "요구사항 명"],
    dateHeaders: ["등록일자"],
    pickSheet: (workbook) => workbook.worksheets[0],
    validate: async (projectId, buffer) => {
      const report = await validateRequirementsImport(projectId, buffer);
      return { rows: report.rows, extra: { willDeleteCount: report.willDeleteCount } };
    },
    apply: async (projectId, userId, buffer) => {
      const outcome = await applyRequirementsImport(projectId, userId, buffer);
      return outcome.report.errorCount > 0 ? { ok: false, rows: outcome.report.rows, extra: { willDeleteCount: outcome.report.willDeleteCount } } : { ok: true, result: { created: outcome.created, updated: outcome.updated, deleted: outcome.deleted } };
    },
    options: async (projectId) => {
      const codes = await listRequirementCodeOptions(projectId);
      return {
        "기능분류": codes.divisions.map((code) => code.label),
        "구분": codes.categories.map((code) => code.label),
        "중요도": ["상", "중", "하"], "우선순위": ["상", "중", "하"],
        "수용여부": Object.values(acceptanceLabels),
        "확정후추가": ["예", "아니요"],
      };
    },
  },
};

export type StagingRowView = { rowNo: number; status: StagedRowStatus; errors: string[]; warnings: string[]; edited: boolean; key: string[]; cells?: StagedCell[] };
export type StagingView = {
  id: string; kind: ImportKind; fileName: string; headers: string[]; summary: StagingSummary; canApply: boolean; version: number; createdAt: string; updatedAt: string;
  rows: StagingRowView[]; keyHeaders: string[]; dateHeaders: string[]; options: Record<string, string[]>;
};

// ---------------------------------------------------------------------------
// 엑셀 ↔ 임시 데이터
// ---------------------------------------------------------------------------
async function readSheet(kind: ImportKind, buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as ArrayBuffer); } catch (error) { throw fileFailure(error); }
  const sheet = ENGINES[kind].pickSheet(workbook);
  if (!sheet) throw new DomainError("INVALID_CODE", "엑셀에 시트가 없습니다.");
  const width = Math.max(sheet.columnCount, sheet.getRow(1).cellCount);
  const read = (row: ExcelJS.Row) => Array.from({ length: width }, (_, index) => normalizeCellValue(row.getCell(index + 1).value));
  const headers = read(sheet.getRow(1)).map((cell) => (cell === null ? "" : String(cell).trim()));
  const rows: { rowNo: number; cells: StagedCell[] }[] = [];
  sheet.eachRow((row, rowNo) => { if (rowNo === 1) return; const cells = read(row); if (!isBlankRow(cells)) rows.push({ rowNo, cells }); });
  return { headers, rows };
}

/** 임시 데이터로 엑셀을 다시 만든다 — 원래 행 번호 위치에 값을 넣어 검증 메시지의 행 번호가 파일과 같게 한다. */
async function buildWorkbook(kind: ImportKind, headers: string[], rows: { rowNo: number; cells: StagedCell[] }[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(ENGINES[kind].sheetName);
  headers.forEach((header, index) => { sheet.getRow(1).getCell(index + 1).value = header || null; });
  for (const row of rows) row.cells.forEach((cell, index) => { if (cell !== null && cell !== "") sheet.getRow(row.rowNo).getCell(index + 1).value = cell; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// 배치 조회·검증 저장
// ---------------------------------------------------------------------------
const kindSchema = z.enum(["WBS", "REQUIREMENT"]);
export const parseImportKind = (value: unknown): ImportKind => kindSchema.parse(value);

async function ownedBatch(projectId: string, userId: string, batchId: string) {
  const batch = await getPrisma().importBatch.findUnique({ where: { id: batchId }, include: { rows: { orderBy: { rowNo: "asc" } } } });
  // 올린 사람만(2026-09-30 결정 4) — 남의 배치는 존재 자체를 드러내지 않는다.
  if (!batch || batch.projectId !== projectId || batch.uploadedBy !== userId) throw new DomainError("NOT_FOUND", "업로드 내역을 찾을 수 없습니다. 다시 업로드해 주세요.");
  return batch;
}
type LoadedBatch = Awaited<ReturnType<typeof ownedBatch>>;

const rowsOf = (batch: LoadedBatch) => batch.rows.map((row) => ({ rowNo: row.rowNo, cells: row.cells as StagedCell[] }));

/** 배치 전체 재검증 → 행 상태·요약 저장. 행 수가 많아(WBS 수천 행) 한 번의 UPDATE로 반영한다. */
async function storeValidation(batchId: string, rowNos: number[], reportRows: ReportRow[], extra: Pick<StagingSummary, "actionCounts" | "willDeleteCount">, bumpVersion: boolean) {
  const { byRow, fileErrors } = mapReportToRows(rowNos, reportRows);
  const summary = stagingSummary(byRow, fileErrors, extra);
  const payload = JSON.stringify([...byRow.entries()].map(([rowNo, value]) => ({ rowNo, ...value })));
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE import_batch_rows r SET status = v.status::"ImportRowStatus", errors = v.errors, warnings = v.warnings
      FROM jsonb_to_recordset(${payload}::jsonb) AS v("rowNo" int, status text, errors jsonb, warnings jsonb)
      WHERE r."batchId" = ${batchId} AND r."rowNo" = v."rowNo"`,
    prisma.importBatch.update({ where: { id: batchId }, data: { summary: summary as unknown as Prisma.InputJsonValue, ...(bumpVersion ? { version: { increment: 1 } } : {}) } }),
  ]);
}

async function revalidate(batch: LoadedBatch, bumpVersion: boolean) {
  const kind = batch.kind as ImportKind;
  const rows = rowsOf(batch);
  const report = await ENGINES[kind].validate(batch.projectId, await buildWorkbook(kind, batch.headers as string[], rows));
  await storeValidation(batch.id, rows.map((row) => row.rowNo), report.rows, report.extra, bumpVersion);
}

async function toView(projectId: string, batchId: string): Promise<StagingView> {
  const batch = await getPrisma().importBatch.findUniqueOrThrow({ where: { id: batchId }, include: { rows: { orderBy: { rowNo: "asc" } } } });
  const kind = batch.kind as ImportKind, engine = ENGINES[kind], headers = batch.headers as string[];
  const keyIndexes = engine.keyHeaders.map((header) => headers.findIndex((h) => h.replace(/\s+/g, "") === header.replace(/\s+/g, "")));
  const summary = batch.summary as unknown as StagingSummary;
  return {
    id: batch.id, kind, fileName: batch.fileName, headers, summary, canApply: canApplyStaging(summary), version: batch.version,
    createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString(),
    // 오류 행은 수정 대화상자용으로 전체 셀을, 정상 행은 식별 열만 보낸다(WBS 수천 행 대비)
    rows: batch.rows.map((row) => {
      const cells = row.cells as StagedCell[];
      return {
        rowNo: row.rowNo, status: row.status, errors: row.errors as string[], warnings: row.warnings as string[], edited: row.edited,
        key: keyIndexes.map((index) => (index >= 0 && cells[index] !== null && cells[index] !== undefined ? String(cells[index]) : "")),
        ...(row.status === "ERROR" ? { cells } : {}),
      };
    }),
    keyHeaders: engine.keyHeaders, dateHeaders: engine.dateHeaders, options: await engine.options(projectId),
  };
}

// ---------------------------------------------------------------------------
// 공개 함수 (라우트에서 호출)
// ---------------------------------------------------------------------------
export async function getMyImportBatch(projectId: string, userId: string, kind: ImportKind): Promise<StagingView | null> {
  const batch = await getPrisma().importBatch.findUnique({ where: { projectId_kind_uploadedBy: { projectId, kind, uploadedBy: userId } }, select: { id: true } });
  return batch ? toView(projectId, batch.id) : null;
}

/** 업로드 → 임시 저장(기존 배치 교체) + 검증. */
export async function createImportBatch(projectId: string, userId: string, kind: ImportKind, fileName: string, buffer: Buffer): Promise<StagingView> {
  await assertManager(projectId, userId);
  const { headers, rows } = await readSheet(kind, buffer);
  const prisma = getPrisma();
  const batch = await prisma.$transaction(async (tx) => {
    await tx.importBatch.deleteMany({ where: { projectId, kind, uploadedBy: userId } });
    const created = await tx.importBatch.create({ data: { projectId, kind, fileName: fileName.slice(0, 200), headers, summary: { total: rows.length, ok: rows.length, error: 0, fileErrors: [] }, uploadedBy: userId } });
    if (rows.length) await tx.importBatchRow.createMany({ data: rows.map((row) => ({ batchId: created.id, rowNo: row.rowNo, cells: row.cells as Prisma.InputJsonValue })) });
    return created;
  }, { timeout: 60_000 });
  await revalidate(await ownedBatch(projectId, userId, batch.id), false);
  await writeAuditLog(projectId, userId, "IMPORT_STAGING_UPLOAD", "import_batches", batch.id, null, { kind, fileName, rows: rows.length });
  return toView(projectId, batch.id);
}

export const updateStagedRowSchema = z.object({ version: z.number().int().positive(), cells: z.record(z.string(), z.string().max(10_000)) });

/** 오류 행 수정 → 배치 전체 재검증. 정상 행은 수정 불가(2026-09-30 결정 3). */
export async function updateStagedRow(projectId: string, userId: string, batchId: string, rowNo: number, input: unknown): Promise<StagingView> {
  const data = updateStagedRowSchema.parse(input);
  const batch = await ownedBatch(projectId, userId, batchId);
  if (batch.version !== data.version) throw new DomainError("VERSION_CONFLICT", "다른 창에서 먼저 수정했습니다. 새로고침 후 다시 수정해 주세요.");
  const row = batch.rows.find((candidate) => candidate.rowNo === rowNo);
  if (!row) throw new DomainError("NOT_FOUND", `엑셀 ${rowNo}행을 찾을 수 없습니다.`);
  if (row.status !== "ERROR") throw new DomainError("INVALID_STATE", "오류가 있는 행만 화면에서 수정할 수 있습니다. 정상 행을 바꾸려면 엑셀을 수정해 다시 올려 주세요.");
  const headers = batch.headers as string[];
  const cells = patchCells(row.cells as StagedCell[], Object.fromEntries(Object.entries(data.cells).map(([key, value]) => [Number(key), value])), headers.length);
  await getPrisma().importBatchRow.update({ where: { id: row.id }, data: { cells: cells as Prisma.InputJsonValue, edited: true, editedAt: new Date() } });
  await revalidate(await ownedBatch(projectId, userId, batchId), true);
  await writeAuditLog(projectId, userId, "IMPORT_STAGING_ROW_EDIT", "import_batches", batchId, { rowNo, cells: row.cells as Prisma.InputJsonValue }, { rowNo, cells: cells as Prisma.InputJsonValue });
  return toView(projectId, batchId);
}

/** 반영 — 성공하면 배치 삭제(2026-09-30 결정 5), 검증 실패면 행 상태를 갱신해 돌려준다. */
export async function applyImportBatch(projectId: string, userId: string, batchId: string, version: number) {
  const batch = await ownedBatch(projectId, userId, batchId);
  if (batch.version !== version) throw new DomainError("VERSION_CONFLICT", "다른 창에서 먼저 수정했습니다. 새로고침 후 다시 반영해 주세요.");
  const kind = batch.kind as ImportKind, rows = rowsOf(batch);
  const outcome = await ENGINES[kind].apply(projectId, userId, await buildWorkbook(kind, batch.headers as string[], rows));
  if (!outcome.ok) {
    await storeValidation(batch.id, rows.map((row) => row.rowNo), outcome.rows, outcome.extra, true);
    return { applied: false as const, view: await toView(projectId, batch.id) };
  }
  await getPrisma().importBatch.delete({ where: { id: batch.id } });
  await writeAuditLog(projectId, userId, "IMPORT_STAGING_APPLY", "import_batches", batch.id, null, { kind, fileName: batch.fileName, rows: rows.length, edited: batch.rows.filter((row) => row.edited).length });
  return { applied: true as const, kind, result: outcome.result as WbsImportApplyResult | { created: number; updated: number; deleted: number } };
}

export async function cancelImportBatch(projectId: string, userId: string, batchId: string) {
  const batch = await ownedBatch(projectId, userId, batchId);
  await getPrisma().importBatch.delete({ where: { id: batch.id } });
  return { id: batch.id };
}

/** 현재 임시 내용(화면 수정 반영)을 엑셀로 — 엑셀을 고쳐 재업로드하기 전에 원본을 갱신하는 용도. */
export async function downloadImportBatch(projectId: string, userId: string, batchId: string) {
  const batch = await ownedBatch(projectId, userId, batchId);
  const kind = batch.kind as ImportKind;
  const buffer = await buildWorkbook(kind, batch.headers as string[], rowsOf(batch));
  const base = batch.fileName.replace(/\.xlsx$/i, "");
  return { buffer, fileName: `${base}_수정본.xlsx` };
}
