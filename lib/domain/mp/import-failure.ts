// WBS2 · 요구사항관리2 엑셀 업로드 실패 상세(2026-09-30) — 서버 오류를 사용자가 조치할 수 있는 문장으로 바꾼다.
// 행 단위 검증 오류는 검증 보고서(rows[].errors)로 이미 보여주고, 여기서는 "파일을 못 읽음"과 "반영(저장) 중 실패"를 다룬다.
// 화면(클라이언트)과 서버가 함께 쓰므로 순수 함수로만 둔다.

export type ImportKind = "wbs" | "requirement";
export type ImportFailureRow = { row: number; action?: string; code?: string; name?: string; displayId?: string };
export type ImportFailure = {
  stage: "file" | "apply";
  reason: string; // 한 줄 원인
  detail: string; // 무엇이 어디서 어긋났는지
  hint: string; // 조치 방법
  row: ImportFailureRow | null; // 반영 중 실패한 행(알 수 있을 때)
  rolledBack: boolean; // true면 파일 전체가 취소되어 DB에 아무것도 반영되지 않음
  errorId: string; // 서버 로그와 맞춰 볼 식별자
  technical: string; // 원본 오류 코드·메시지(개발자 확인용)
};

type RawError = { name?: string; code?: string; message?: string; meta?: unknown };

const LABEL: Record<ImportKind, { item: string; id: string; idPrefix: string }> = {
  wbs: { item: "Task", id: "TASK ID", idPrefix: "WBS-" },
  requirement: { item: "요구사항", id: "요구사항 표시 ID", idPrefix: "REQ-" },
};

const rowText = (row: ImportFailureRow | null) => (row ? `엑셀 ${row.row}행${row.code ? ` (${row.code}${row.name ? ` ${row.name}` : ""})` : row.name ? ` (${row.name})` : ""}` : "");

/** 엑셀 파일 자체를 열지 못했을 때 — .xlsx가 아니거나 손상·암호 설정. */
export function describeFileFailure(error: RawError, errorId: string): ImportFailure {
  const message = error.message ?? "";
  const encrypted = /encrypt|password|CFB|compound/i.test(message);
  return {
    stage: "file", row: null, rolledBack: true, errorId,
    reason: encrypted ? "암호가 걸린 엑셀 파일이라 읽을 수 없습니다." : "엑셀 파일을 읽을 수 없습니다.",
    detail: encrypted
      ? "보안(DRM)·열기 암호가 설정된 파일은 서버에서 내용을 읽지 못합니다."
      : "파일이 .xlsx 형식이 아니거나(.xls·.csv를 확장자만 바꾼 경우 포함) 손상되었습니다.",
    hint: encrypted
      ? "엑셀에서 암호·보안을 해제하고 [다른 이름으로 저장 → Excel 통합 문서(*.xlsx)]로 저장한 뒤 다시 올려 주세요."
      : "엑셀에서 파일을 연 뒤 [다른 이름으로 저장 → Excel 통합 문서(*.xlsx)]로 저장해 다시 올려 주세요. 가능하면 화면의 [엑셀 다운로드] 서식을 사용하세요.",
    technical: `${error.name ?? "Error"}: ${message}`.slice(0, 500),
  };
}

/** 반영(DB 저장) 중 실패 — Prisma 오류 코드를 원인·조치로 바꾼다. 트랜잭션이라 항상 전체 취소된다. */
export function describeApplyFailure(kind: ImportKind, error: RawError, row: ImportFailureRow | null, errorId: string): ImportFailure {
  const label = LABEL[kind];
  const meta = JSON.stringify(error.meta ?? {});
  const where = rowText(row);
  const base = { stage: "apply" as const, row, rolledBack: true, errorId, technical: `${error.code ?? error.name ?? "Error"}: ${(error.message ?? "").split("\n").filter(Boolean).slice(-1)[0] ?? ""}`.slice(0, 500) };

  if (error.code === "P2002") {
    const onDisplayId = /displayId/.test(meta) || /displayId/.test(error.message ?? "");
    if (onDisplayId) return {
      ...base,
      reason: `${label.id} 중복으로 저장하지 못했습니다.`,
      detail: `${where ? `${where}에 ` : ""}새로 발급하려던 ${label.id}${row?.displayId ? `(${row.displayId})` : ""}가 이미 다른 프로젝트에서 쓰이고 있습니다. ${label.id}는 시스템 전체에서 하나여야 하는데 이 프로젝트의 순번이 다른 프로젝트 구간과 겹쳤습니다.`,
      hint: "관리자에게 이 프로젝트의 순번 구간 설정(전환작업 절차 A-4, scripts/mp-seed-sequences.ts)을 요청한 뒤 다시 반영해 주세요. 파일은 수정할 필요가 없습니다.",
    };
    const field = /requirementId/.test(meta) ? "요구사항 ID" : /path/.test(meta) ? `${label.item} 코드` : "고유 값";
    return {
      ...base,
      reason: `${field} 중복으로 저장하지 못했습니다.`,
      detail: `${where ? `${where}의 ` : ""}${field}가 이미 등록된 값과 겹칩니다. 검증 후 반영하기 전 사이에 다른 사용자가 같은 값을 등록했을 수 있습니다.`,
      hint: "[검증(Dry-run)]을 다시 실행해 겹치는 행을 확인하고 수정한 뒤 반영해 주세요.",
    };
  }
  if (error.code === "P2003") return {
    ...base,
    reason: "연결된 데이터가 없어 저장하지 못했습니다.",
    detail: `${where ? `${where}이 ` : ""}참조하는 담당자·업무그룹·상위 ${label.item} 중 하나가 검증 이후 삭제되었거나 비활성화되었습니다.`,
    hint: "[검증(Dry-run)]을 다시 실행해 담당자·Track·상위 코드를 확인한 뒤 반영해 주세요.",
  };
  if (error.code === "P2025") return {
    ...base,
    reason: `수정·삭제할 ${label.item}을(를) 찾지 못했습니다.`,
    detail: `${where ? `${where}의 ` : ""}대상이 검증 이후 다른 사용자에 의해 삭제되었거나 변경되었습니다.`,
    hint: "목록을 새로 확인하고 [검증(Dry-run)]부터 다시 진행해 주세요.",
  };
  if (error.code === "P2028" || /transaction/i.test(error.message ?? "") && /timeout|expired|closed/i.test(error.message ?? "")) return {
    ...base,
    reason: "처리 시간이 초과되어 저장하지 못했습니다.",
    detail: `한 번에 반영할 행이 많거나 서버가 바빠 제한 시간 안에 끝나지 않았습니다.${where ? ` 마지막 처리 위치: ${where}.` : ""}`,
    hint: "파일을 여러 개로 나눠(예: 500행 단위) 차례로 반영하거나, 잠시 후 다시 시도해 주세요.",
  };
  if (error.code === "P2000") return {
    ...base,
    reason: "입력값이 너무 길어 저장하지 못했습니다.",
    detail: `${where ? `${where}의 ` : ""}어느 칸의 글자 수가 저장 한도를 넘었습니다.`,
    hint: "해당 행의 이름·설명·비고 등 긴 칸을 줄여 다시 반영해 주세요.",
  };
  return {
    ...base,
    reason: "반영 중 예상하지 못한 오류가 발생했습니다.",
    detail: `${where ? `${where}을(를) 처리하던 중 ` : ""}오류가 발생해 파일 전체를 취소했습니다.`,
    hint: `같은 파일로 다시 시도해도 반복되면 오류 ID(${errorId})와 함께 관리자에게 알려 주세요.`,
  };
}

/** 계획한 신규 표시 ID 중 이미 쓰이는 것을 찾아 행별 검증 오류 문구로 만든다(반영 전 사전 차단). */
export function displayIdConflictMessage(kind: ImportKind, displayId: string, ownerProjectCode: string | null) {
  const label = LABEL[kind];
  return `새로 발급될 ${label.id}(${displayId})가 이미 ${ownerProjectCode ? `프로젝트 ${ownerProjectCode}에서` : "다른 항목에서"} 쓰이고 있습니다 — 이 프로젝트의 순번 구간이 설정되지 않았습니다. 관리자에게 순번 구간 설정(A-4)을 요청해 주세요.`;
}
