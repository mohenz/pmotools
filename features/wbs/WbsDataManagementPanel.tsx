"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { WbsImportApplyResult, WbsImportReport } from "@/lib/server/wbs-excel";
import { WarningDialog } from "@/components/WarningDialog";

const OUTCOME_LABEL: Record<WbsImportApplyResult["rows"][number]["outcome"], string> = {
  deleted: "삭제(보관)", delete_not_found: "삭제 대상 없음", created: "생성", updated: "수정",
};
const ACTION_LABEL = { "": "유지", D: "삭제(보관)", U: "수정", I: "등록" } as const;

export function WbsDataManagementPanel({ children }: { children?: React.ReactNode } = {}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<WbsImportReport | null>(null);
  const [applyResult, setApplyResult] = useState<WbsImportApplyResult | null>(null);
  const [pending, setPending] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  async function validate(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending("validate"); setUploadMessage(""); setReport(null); setApplyResult(null);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/wbs-items/excel/import/validate", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setUploadMessage(payload?.error?.message ?? "검증에 실패했습니다."); return; }
    setReport(payload.data);
  }
  async function apply() {
    if (!file) return;
    setPending("apply"); setUploadMessage(""); setApplyResult(null);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/wbs-items/excel/import", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setUploadMessage(payload?.error?.message ?? "반영에 실패했습니다."); if (payload?.data) setReport(payload.data); return; }
    setApplyResult(payload.data);
    setReport(null); setFile(null);
    router.refresh();
  }
  async function reset() {
    setPending("reset"); setResetMessage("");
    const response = await fetch("/api/v1/wbs-items/reset", { method: "POST" });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setResetMessage(payload?.error?.message ?? "초기화에 실패했습니다."); return; }
    setResetMessage(`${payload.data.archivedCount}건이 보관 처리되었습니다.`);
    router.refresh();
  }

  const canApply = report && report.errorCount === 0 && report.validCount > 0;
  const actionSummary = report ? `유지 ${report.actionCounts.blank}건 · 삭제 ${report.actionCounts.delete}건 · 수정 ${report.actionCounts.update}건 · 신규 ${report.actionCounts.insert}건` : "";

  return <>
    <section className="panel compact">
      <div className="panel-head"><h2>엑셀 다운로드</h2></div>
      <div className="wbs-inline-form">
        <label>현재 WBS 목록<a className="button secondary" href="/api/v1/wbs-items/excel/export">엑셀로 내려받기</a></label>
        <label>업로드 양식 및 작성 예시<a className="button secondary" href="/api/v1/wbs-items/excel/sample">샘플 엑셀 다운로드</a></label>
      </div>
    </section>

    <section className="panel compact">
      <div className="panel-head"><h2>엑셀 업로드</h2><span>가장 왼쪽 &apos;작업구분&apos; 컬럼 기준 반영 — 빈칸은 기존 데이터 유지, D는 삭제(보관), U는 기존 Task 수정, I는 신규 Task 삽입</span></div>
      <div className="wbs-inline-form">
        <label>엑셀 파일<input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setReport(null); setApplyResult(null); setUploadMessage(""); }} /></label>
        <button className="button secondary" type="button" onClick={validate} disabled={!file || !!pending}>{pending === "validate" ? "검증 중…" : "검증(Dry-run)"}</button>
        {canApply && <button className="button primary" type="button" onClick={apply} disabled={!!pending}>{pending === "apply" ? "반영 중…" : `반영 (${actionSummary})`}</button>}
      </div>
      <WarningDialog message={uploadMessage} onClose={() => setUploadMessage("")} />
      {report && (() => {
        const targetRows = report.rows.filter((row) => row.action !== "");
        const visibleRows = report.rows.filter((row) => row.action !== "" || row.errors.length || row.warnings.length);
        return <div className="table-wrap">
          <h3>반영 대상 목록</h3>
          <p className="table-wrap-note">등록·수정·삭제 대상 {targetRows.length}건입니다. 유지 행은 오류·경고가 있을 때만 표시합니다.{report.errorCount > 0 ? " 오류를 수정하고 다시 검증해 주세요." : " 아래 대상을 확인한 후 반영해 주세요."}</p>
          <table>
            <thead><tr><th>행</th><th>작업구분</th><th>Task</th><th>이름</th><th>오류</th><th>경고</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => <tr className={row.errors.length ? "high-risk-row" : ""} key={row.row}>
                <td>{row.row}</td><td>{ACTION_LABEL[row.action]}{row.action ? ` (${row.action})` : ""}</td><td className="mono">{row.code}</td><td>{row.name}</td>
                <td>{row.errors.join(" / ") || "-"}</td><td>{row.warnings.join(" / ") || "-"}</td>
              </tr>)}
              {!report.rows.length && <tr><td colSpan={6} className="empty">읽을 수 있는 행이 없습니다.</td></tr>}
              {report.rows.length > 0 && !visibleRows.length && <tr><td colSpan={6} className="empty">등록·수정·삭제 대상이 없습니다. 모든 행을 유지합니다.</td></tr>}
            </tbody>
          </table>
        </div>;
      })()}
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
