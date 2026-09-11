import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

const mocks = vi.hoisted(() => ({
  existing: [] as { id: string; path: string; actualStartDate: Date | null; actualDueDate: Date | null }[],
  update: vi.fn(), create: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/server/permissions", () => ({ assertManager: vi.fn() }));
vi.mock("@/lib/server/db-pg", () => {
  const tx = {
    wbsItem: { update: mocks.update, create: mocks.create, findMany: async () => mocks.existing },
    projectMember: { findMany: async () => [] },
    holiday: { findMany: async () => [{ date: new Date("2026-09-07") }] },
    wbsItemSequence: { findUnique: async () => null, upsert: vi.fn() },
    wbsAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
    wbsDeliverable: { deleteMany: vi.fn() },
  };
  return { getPrisma: () => ({ ...tx, $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx) }), actorNameOf: async () => "tester", writeAuditLog: vi.fn() };
});
vi.mock("@/lib/server/wbs", async (original) => ({
  ...await original<typeof import("./wbs")>(), listWbsWorkGroups: async () => [],
}));
import { applyWbsImport, validateWbsImport, exportWbsSample } from "./wbs-excel";
import { WBS_EXCEL_HEADERS } from "./wbs";

async function file(values: Record<string, ExcelJS.CellValue>, actual = true) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("WBS");
  const headers = ["작업구분", ...WBS_EXCEL_HEADERS, ...(actual ? ["실적시작일", "실적종료일", "지연완료", "지연완료일자", "지연일자"] : [])];
  sheet.addRow(headers);
  sheet.addRow(headers.map(h => ({ 작업구분: "I", Task: "1", "Task Description": "테스트", StartDate: "2026-09-01", DueDate: "2026-09-04", ...values })[h] ?? null));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
beforeEach(() => { mocks.existing = []; vi.clearAllMocks(); });
describe("WBS Excel actual dates", () => {
  it("downloads a sample with unused codes that passes the import validator", async () => {
    mocks.existing = [{ id: "w", path: "0001", actualStartDate: null, actualDueDate: null }];
    const buffer = await exportWbsSample("p");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(workbook.worksheets.map(s => s.name)).toEqual(["WBS", "작성안내"]);
    expect(workbook.worksheets[0].getRow(2).getCell(7).value).toBe("2");
    expect(workbook.worksheets[0].getRow(3).getCell(50).value).toEqual(new Date("2026-09-01"));
    const report = await validateWbsImport("p", buffer);
    expect(report.errorCount).toBe(0);
    expect(report.actionCounts.insert).toBe(4);
  });
  it("saves dates and recalculates delay excluding weekends and holidays", async () => {
    const buffer = await file({ 실적시작일: new Date("2026-09-01"), 실적종료일: "2026.9.8", 지연완료: 0, 지연일자: 999 });
    const result = await applyWbsImport("p", "u", buffer);
    expect(result.report.errorCount).toBe(0);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ actualStartDate: new Date("2026-09-01"), actualDueDate: new Date("2026-09-08"), isDelayedCompletion: true, delayedCompletionDate: new Date("2026-09-08"), delayDays: 1, status: "completed" });
  });
  it("clears delayed completion when corrected to on-time completion", async () => {
    mocks.existing = [{ id: "w", path: "0001", actualStartDate: new Date("2026-09-01"), actualDueDate: new Date("2026-09-08") }];
    await applyWbsImport("p", "u", await file({ 작업구분: "U", 실적시작일: "2026-09-01", 실적종료일: "2026-09-04" }));
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ isDelayedCompletion: false, delayedCompletionDate: null, delayDays: null });
  });
  it("preserves actual dates in legacy uploads", async () => {
    mocks.existing = [{ id: "w", path: "0001", actualStartDate: new Date("2026-09-01"), actualDueDate: new Date("2026-09-08") }];
    await applyWbsImport("p", "u", await file({ 작업구분: "U" }, false));
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ actualDueDate: new Date("2026-09-08"), delayDays: 1 });
  });
  it("clears actual dates and delay when included cells are blank", async () => {
    mocks.existing = [{ id: "w", path: "0001", actualStartDate: new Date("2026-09-01"), actualDueDate: new Date("2026-09-08") }];
    await applyWbsImport("p", "u", await file({ 작업구분: "U" }));
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ actualStartDate: null, actualDueDate: null, isDelayedCompletion: false, delayDays: null });
  });
  it.each([
    { 실적종료일: "2026-09-08" },
    { 실적시작일: "2026-02-30" },
    { 실적시작일: "2026-09-08", 실적종료일: "2026-09-01" },
  ])("rejects invalid actual dates: %j", async values => {
    const report = await validateWbsImport("p", await file(values));
    expect(report.errorCount).toBe(1);
  });
});
