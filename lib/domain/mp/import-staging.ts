// 엑셀 업로드 임시 저장(스테이징) 순수 로직(2026-09-30) — 셀 값 정규화, 검증 결과 → 행 상태, 화면용 요약.
// 서버(임시 저장·재검증)와 테스트가 함께 쓴다. ExcelJS 타입에 의존하지 않도록 값 모양만 본다.

export type StagedCell = string | number | boolean | null;
export type StagedRowStatus = "OK" | "ERROR";
export type ReportRow = { row: number; errors: string[]; warnings: string[] };
export type StagingSummary = {
  total: number; ok: number; error: number;
  fileErrors: string[]; // 특정 행이 아닌 파일 단위 오류(헤더 누락 등) — 화면 수정 불가, 엑셀 재업로드 필요
  actionCounts?: { blank: number; delete: number; update: number; insert: number }; // WBS
  willDeleteCount?: number; // 요구사항: 파일에 없는 기존 요구사항 삭제 예정 건수
};

const pad = (n: number) => String(n).padStart(2, "0");
const utcDate = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/**
 * ExcelJS 셀 값 → 저장용 기본값. 날짜는 YYYY-MM-DD(UTC — 엑셀 날짜는 자정 UTC로 읽힘), 리치텍스트·하이퍼링크는 표시 텍스트,
 * 수식은 결과값, 오류값(#N/A 등)은 빈 값. 숫자·문자·참거짓은 그대로 둔다(검증 로직이 날짜 일련번호 숫자도 해석).
 */
export function normalizeCellValue(value: unknown): StagedCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : utcDate(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text?: string }[]).map((part) => part.text ?? "").join("");
    if ("result" in v) return normalizeCellValue(v.result);
    if ("formula" in v || "sharedFormula" in v) return null;
    if ("text" in v) { const text = String(v.text ?? "").trim(); return text || (typeof v.hyperlink === "string" ? v.hyperlink : ""); }
    if (typeof v.hyperlink === "string") return v.hyperlink;
    if ("error" in v) return null;
  }
  return String(value);
}

export const isBlankRow = (cells: StagedCell[]) => cells.every((cell) => cell === null || (typeof cell === "string" && cell.trim() === ""));

/**
 * 검증 보고서 행을 임시 저장 행에 맞춘다. 보고서에 없는 행(예: 작업구분 빈칸이라 건너뛴 행)은 정상.
 * 임시 저장 행에 없는 행 번호의 오류(헤더 누락처럼 파일 단위)는 fileErrors로 모은다.
 */
export function mapReportToRows(stagedRowNos: number[], reportRows: ReportRow[]) {
  const staged = new Set(stagedRowNos);
  const byRow = new Map<number, { status: StagedRowStatus; errors: string[]; warnings: string[] }>();
  const fileErrors: string[] = [];
  for (const rowNo of stagedRowNos) byRow.set(rowNo, { status: "OK", errors: [], warnings: [] });
  for (const report of reportRows) {
    if (!staged.has(report.row)) { fileErrors.push(...report.errors); continue; }
    const target = byRow.get(report.row)!;
    target.errors.push(...report.errors);
    target.warnings.push(...report.warnings);
    if (target.errors.length) target.status = "ERROR";
  }
  return { byRow, fileErrors: Array.from(new Set(fileErrors)) };
}

export function stagingSummary(byRow: Map<number, { status: StagedRowStatus }>, fileErrors: string[], extra: Pick<StagingSummary, "actionCounts" | "willDeleteCount"> = {}): StagingSummary {
  const statuses = [...byRow.values()];
  const error = statuses.filter((row) => row.status === "ERROR").length;
  return { total: statuses.length, ok: statuses.length - error, error, fileErrors, ...extra };
}

/** 반영 가능 여부 — 파일 단위 오류가 없고, 오류 행이 없고, 행이 하나 이상. */
export const canApplyStaging = (summary: StagingSummary) => summary.fileErrors.length === 0 && summary.error === 0 && summary.total > 0;

/** 화면 수정값 적용 — 수정은 오류 행만(2026-09-30 결정 3). 인덱스 범위를 벗어나면 무시, 빈 문자열은 빈 칸(null). */
export function patchCells(cells: StagedCell[], patch: Record<number, string>, width: number): StagedCell[] {
  const next = [...cells];
  while (next.length < width) next.push(null);
  for (const [key, value] of Object.entries(patch)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= width) continue;
    const trimmed = value.trim();
    next[index] = trimmed === "" ? null : trimmed;
  }
  return next;
}
