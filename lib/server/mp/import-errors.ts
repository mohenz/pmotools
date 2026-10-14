import "server-only";

import { NextResponse } from "next/server";
import { describeApplyFailure, describeFileFailure, type ImportFailure, type ImportFailureRow, type ImportKind } from "@/lib/domain/mp/import-failure";

// 엑셀 업로드 실패 상세(2026-09-30) — 파일을 못 읽거나 반영(저장) 중 실패하면 원인·행·조치를 담아 던지고, 라우트가 그대로 응답한다.
export class ImportFailureError extends Error {
  constructor(public failure: ImportFailure) {
    super(failure.reason);
  }
}

const newErrorId = () => `IMP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
const raw = (error: unknown) => (error && typeof error === "object" ? error as { name?: string; code?: string; message?: string; meta?: unknown } : { message: String(error) });

/** xlsx 로드 실패를 상세 오류로 바꿔 던진다. 서버 로그에는 오류 ID와 원본 오류를 남긴다. */
export function fileFailure(error: unknown): ImportFailureError {
  const failure = describeFileFailure(raw(error), newErrorId());
  console.error(`[excel-import] ${failure.errorId} file`, error);
  return new ImportFailureError(failure);
}

/** 반영 트랜잭션 실패를 상세 오류로 바꿔 던진다(트랜잭션이라 전체 취소). */
export function applyFailure(kind: ImportKind, error: unknown, row: ImportFailureRow | null): ImportFailureError {
  if (error instanceof ImportFailureError) return error;
  const failure = describeApplyFailure(kind, raw(error), row, newErrorId());
  console.error(`[excel-import] ${failure.errorId} apply ${kind} row=${row?.row ?? "-"}`, error);
  return new ImportFailureError(failure);
}

/** 라우트용 — 상세 오류면 응답을 만들고, 아니면 null(기존 mutationErrorResponse로 처리). */
export function importFailureResponse(error: unknown) {
  if (!(error instanceof ImportFailureError)) return null;
  const { failure } = error;
  return NextResponse.json({ error: { code: failure.stage === "file" ? "EXCEL_FILE_UNREADABLE" : "EXCEL_APPLY_FAILED", message: failure.reason, failure } }, { status: failure.stage === "file" ? 400 : 409 });
}
