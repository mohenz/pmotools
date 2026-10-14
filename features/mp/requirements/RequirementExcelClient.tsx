"use client";
// [WBS2 복사본] 원본: features/requirements/RequirementExcelClient.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
// 2026-09-30: 업로드는 임시 저장 방식(ImportStagingPanel) — 행별 정상/오류 확인 → 오류 행 화면 수정 또는 엑셀 재업로드 → 반영.

import { useState } from "react";
import Link from "next/link";
import { ImportStagingPanel } from "@/features/mp/ImportStagingPanel";

type ApplyResult = { created: number; updated: number; deleted: number };

export function RequirementExcelClient() {
  const [message, setMessage] = useState("");
  return <>
    <header className="topbar"><div><h1>요구사항 엑셀 업/다운로드</h1><p>요구사항정의서를 엑셀로 내려받거나, 표준 서식으로 대량 등록/수정합니다.</p></div><Link className="button secondary" href="/mp-requirements">요구사항정의서로</Link></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>다운로드</h2></div>
        <a className="button primary" href="/api/v1/mp/requirements/excel/export">엑셀 다운로드</a>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>업로드</h2><span>요구사항 ID가 일치하면 갱신, 파일에 없는 기존 요구사항 ID는 삭제, 새 요구사항 ID(또는 빈 값)는 신규 등록됩니다.</span></div>
        {message && <p className="form-success" role="status">{message}</p>}
        <ImportStagingPanel kind="REQUIREMENT" description="요구사항 ID 기준으로 파일 전체를 동기화합니다."
          applyConfirm={(view) => `정상 ${view.summary.ok}행으로 요구사항을 동기화합니다.${view.summary.willDeleteCount ? ` 파일에 없는 기존 요구사항 ${view.summary.willDeleteCount}건은 삭제되며 되돌릴 수 없습니다.` : ""}`}
          onApplied={(result) => { const r = result as ApplyResult; setMessage(`신규 ${r.created}건 · 수정 ${r.updated}건 · 삭제 ${r.deleted}건을 반영했습니다.`); }} />
      </section>
    </div>
  </>;
}
