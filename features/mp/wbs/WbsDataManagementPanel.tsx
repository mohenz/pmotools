"use client";
// [WBS2 복사본] 원본: features/wbs/WbsDataManagementPanel.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { WbsImportApplyResult } from "@/lib/server/mp/wbs-excel";
import { WarningDialog } from "@/components/WarningDialog";
import { ImportStagingPanel } from "@/features/mp/ImportStagingPanel";

const OUTCOME_LABEL: Record<WbsImportApplyResult["rows"][number]["outcome"], string> = {
  deleted: "삭제(보관)", delete_not_found: "삭제 대상 없음", created: "생성", updated: "수정",
};

export function WbsDataManagementPanel({ children }: { children?: React.ReactNode } = {}) {
  const router = useRouter();
  const [applyResult, setApplyResult] = useState<WbsImportApplyResult | null>(null);
  const [pending, setPending] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  async function reset() {
    setPending("reset"); setResetMessage("");
    const response = await fetch("/api/v1/mp/wbs-items/reset", { method: "POST" });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setResetMessage(payload?.error?.message ?? "초기화에 실패했습니다."); return; }
    setResetMessage(`${payload.data.archivedCount}건이 보관 처리되었습니다.`);
    router.refresh();
  }

  return <>
    <section className="panel compact">
      <div className="panel-head"><h2>엑셀 다운로드</h2></div>
      <div className="wbs-inline-form">
        <label>현재 WBS 목록<a className="button secondary" href="/api/v1/mp/wbs-items/excel/export">엑셀로 내려받기</a></label>
        <label>업로드 양식 및 작성 예시<a className="button secondary" href="/api/v1/mp/wbs-items/excel/sample">샘플 엑셀 다운로드</a></label>
      </div>
    </section>

    <section className="panel compact">
      <div className="panel-head"><h2>엑셀 업로드</h2><span>가장 왼쪽 &apos;작업구분&apos; 컬럼 기준 반영 — 빈칸은 기존 데이터 유지, D는 삭제(보관), U는 기존 Task 수정, I는 신규 Task 삽입</span></div>
      {/* 임시 저장 방식(2026-09-30) — 업로드 → 행별 정상/오류 → 오류 행 화면 수정 또는 엑셀 재업로드 → 반영 */}
      <ImportStagingPanel kind="WBS" description="Task 코드 기준으로 작업구분(D·U·I)이 있는 행만 반영됩니다."
        applyConfirm={(view) => view.summary.actionCounts ? `삭제 ${view.summary.actionCounts.delete}건 · 수정 ${view.summary.actionCounts.update}건 · 신규 ${view.summary.actionCounts.insert}건을 반영합니다(유지 ${view.summary.actionCounts.blank}건).` : ""}
        onApplied={(result) => { setApplyResult(result as WbsImportApplyResult); router.refresh(); }} />
      {applyResult && (() => {
        const c = applyResult.counts;
        const changedRows = applyResult.rows.filter((row) => row.outcome !== "delete_not_found");
        return <div className="table-wrap">
          <p className="form-success" role="status">
            반영 완료 — 유지 {c.blank}건 · 삭제 {c.deleted}건{c.deleteNotFound ? `(대상 없음 ${c.deleteNotFound}건)` : ""} · 수정 {c.updated}건 · 신규 {c.created}건
          </p>
          <table>
            <thead><tr><th>행</th><th>작업구분</th><th>Task</th><th>이름</th><th>처리 결과</th></tr></thead>
            <tbody>
              {applyResult.rows.map((row) => <tr key={row.row}>
                <td>{row.row}</td><td className="mono">{row.action}</td><td className="mono">{row.code}</td><td>{row.name}</td>
                <td>{OUTCOME_LABEL[row.outcome]}</td>
              </tr>)}
              {!changedRows.length && <tr><td colSpan={5} className="empty">삭제·생성·수정된 행이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>;
      })()}
    </section>

    {children}

    <section className="danger-zone">
      <div><strong>데이터 초기화</strong><p>프로젝트의 모든 WBS 항목이 보관 처리됩니다(목록·조회에서 제외, 복구 가능).</p>{resetMessage && resetMessage.includes("보관 처리") && <p className="form-success" role="status">{resetMessage}</p>}<WarningDialog message={resetMessage && !resetMessage.includes("보관 처리") ? resetMessage : ""} onClose={() => setResetMessage("")} /></div>
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={!!pending}>{pending === "reset" ? "처리 중…" : "초기화"}</button></AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="calendar-modal-backdrop" />
          <AlertDialog.Content className="alert-dialog">
            <AlertDialog.Title asChild><h2>WBS 데이터를 초기화하시겠습니까?</h2></AlertDialog.Title>
            <AlertDialog.Description asChild><p>프로젝트의 모든 WBS 항목이 보관 처리됩니다(목록·조회에서 제외, 복구 가능).</p></AlertDialog.Description>
            <div className="alert-dialog-actions">
              <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button className="button danger" type="button" onClick={reset}>초기화</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  </>;
}
