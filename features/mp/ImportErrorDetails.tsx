"use client";

import type { ImportFailure } from "@/lib/domain/mp/import-failure";

// WBS2 · 요구사항관리2 엑셀 업로드 오류 상세(2026-09-30).
//  - ImportFailurePanel: 파일을 못 읽거나 반영(저장) 중 실패, 권한·상태 오류 — 원인·문제 행·조치·오류 ID를 한 패널에
//  - ImportErrorSummary: 검증(Dry-run) 행 오류를 유형별로 묶어 건수·해당 행 번호를 보여 준다

export type UploadError = { status: number; code: string; message: string; failure?: ImportFailure };

/** fetch 응답에서 화면용 오류를 만든다. 서버가 상세(failure)를 주지 않은 오류도 코드·HTTP 상태를 함께 보여 준다. */
export function uploadErrorOf(response: Response, payload: unknown, fallback: string): UploadError {
  const error = (payload as { error?: { code?: string; message?: string; failure?: ImportFailure } } | null)?.error;
  return { status: response.status, code: error?.code ?? (response.status >= 500 ? "SERVER_ERROR" : "UNKNOWN"), message: error?.message ?? fallback, failure: error?.failure };
}

const GENERIC_HINT: Record<string, string> = {
  FORBIDDEN: "업로드는 운영자 이상만 할 수 있습니다. 권한이 필요하면 관리자에게 요청해 주세요.",
  INVALID_STATE: "상단 '대상 프로젝트'를 하위 프로젝트로 바꾼 뒤 다시 시도해 주세요.",
  VALIDATION_ERROR: "아래 검증 결과에서 오류 행을 수정하고 [검증(Dry-run)]부터 다시 진행해 주세요.",
  AUTH_REQUIRED: "로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.",
};

export function ImportFailurePanel({ error, onClose }: { error: UploadError; onClose: () => void }) {
  const f = error.failure;
  const hint = f?.hint ?? GENERIC_HINT[error.code] ?? (error.status >= 500 ? "잠시 후 다시 시도하고, 반복되면 관리자에게 화면 캡처와 함께 알려 주세요." : "입력한 파일과 선택한 대상 프로젝트를 확인해 주세요.");
  return <div className="import-failure" role="alert">
    <div className="import-failure-head">
      <strong>{f ? (f.stage === "file" ? "파일을 읽지 못했습니다" : "반영하지 못했습니다") : "업로드를 처리하지 못했습니다"}</strong>
      <button className="button ghost small" type="button" onClick={onClose} aria-label="오류 닫기">닫기</button>
    </div>
    <dl>
      <dt>원인</dt><dd>{f?.reason ?? error.message}</dd>
      {f?.detail && <><dt>상세</dt><dd>{f.detail}</dd></>}
      {f?.row && <><dt>문제 행</dt><dd>
        엑셀 {f.row.row}행{f.row.action ? ` · 작업구분 ${f.row.action}` : ""}{f.row.code ? ` · ${f.row.code}` : ""}{f.row.name ? ` · ${f.row.name}` : ""}{f.row.displayId ? ` · 발급하려던 ID ${f.row.displayId}` : ""}
      </dd></>}
      <dt>반영 여부</dt><dd>{f?.stage === "apply" || error.code === "VALIDATION_ERROR" ? <strong>파일 전체가 취소되어 아무것도 반영되지 않았습니다.</strong> : "반영 전 단계에서 멈췄습니다. 데이터는 바뀌지 않았습니다."}</dd>
      <dt>조치 방법</dt><dd>{hint}</dd>
    </dl>
    <details className="import-failure-tech">
      <summary>관리자 확인용 정보</summary>
      <p className="mono">HTTP {error.status} · {error.code}{f ? ` · 오류 ID ${f.errorId}` : ""}</p>
      {f?.technical && <p className="mono">{f.technical}</p>}
    </details>
  </div>;
}

type RowWithErrors = { row: number; errors: string[] };

// 괄호 안 값·숫자를 지워 같은 유형의 오류를 묶는다. 예: "상위 Task(3.1)가 없습니다." → "상위 Task(…)가 없습니다."
const kindOf = (message: string) => message.replace(/\([^)]*\)/g, "(…)").replace(/\d+행/g, "N행").trim();

export function ImportErrorSummary({ rows }: { rows: RowWithErrors[] }) {
  const groups = new Map<string, { sample: string; rows: number[] }>();
  for (const row of rows) for (const message of row.errors) {
    const key = kindOf(message);
    const group = groups.get(key) ?? { sample: message, rows: [] };
    if (!group.rows.includes(row.row)) group.rows.push(row.row);
    groups.set(key, group);
  }
  if (!groups.size) return null;
  const sorted = [...groups.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length);
  const errorRowCount = rows.filter((row) => row.errors.length).length;
  return <div className="import-error-summary" role="alert">
    <strong>오류 {errorRowCount}행 · {groups.size}가지 유형 — 모두 고쳐야 반영할 수 있습니다</strong>
    <table>
      <thead><tr><th>오류 유형</th><th>건수</th><th>해당 행</th></tr></thead>
      <tbody>{sorted.map(([key, group]) => <tr key={key}>
        <td>{key === group.sample ? key : <>{key}<small className="import-error-example">예: {group.sample}</small></>}</td>
        <td data-numeric>{group.rows.length}</td>
        <td className="mono">{group.rows.slice(0, 20).join(", ")}{group.rows.length > 20 ? ` 외 ${group.rows.length - 20}행` : ""}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
