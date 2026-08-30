"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { WbsImportReport } from "@/lib/server/wbs-excel";

export function WbsDataManagementPanel({ children }: { children?: React.ReactNode } = {}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<WbsImportReport | null>(null);
  const [pending, setPending] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  async function validate(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending("validate"); setUploadMessage(""); setReport(null);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/wbs-items/excel/import/validate", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setUploadMessage(payload?.error?.message ?? "검증에 실패했습니다."); return; }
    setReport(payload.data);
  }
  async function apply() {
    if (!file) return;
    setPending("apply"); setUploadMessage("");
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/wbs-items/excel/import", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setUploadMessage(payload?.error?.message ?? "반영에 실패했습니다."); if (payload?.data) setReport(payload.data); return; }
    setUploadMessage(`${payload.data.imported}건을 반영했습니다. 기존 데이터는 전부 교체되었습니다.`);
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

  return <>
    <section className="panel compact">
      <div className="panel-head"><h2>엑셀 다운로드</h2></div>
      <div className="wbs-inline-form">
        <label>현재 WBS 목록<a className="button secondary" href="/api/v1/wbs-items/excel/export">엑셀로 내려받기</a></label>
      </div>
    </section>

    <section className="panel compact">
      <div className="panel-head"><h2>엑셀 업로드</h2><span>전체 교체 — 기존 데이터를 지우고 파일 내용으로 새로 만듭니다</span></div>
      <div className="wbs-inline-form">
        <label>엑셀 파일<input type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setReport(null); setUploadMessage(""); }} /></label>
        <button className="button secondary" type="button" onClick={validate} disabled={!file || !!pending}>{pending === "validate" ? "검증 중…" : "검증(Dry-run)"}</button>
        {canApply && <button className="button primary" type="button" onClick={apply} disabled={!!pending}>{pending === "apply" ? "반영 중…" : `반영 (${report.validCount}건, 기존 데이터 삭제됨)`}</button>}
      </div>
      {uploadMessage && <p className={uploadMessage.includes("반영") ? "form-success" : "form-error"} role="status">{uploadMessage}</p>}
      {report && (() => {
        const issueRows = report.rows.filter((row) => row.errors.length || row.warnings.length);
        return <div className="table-wrap">
          <p className="table-wrap-note">전체 {report.rows.length}행 중 오류·경고가 있는 {issueRows.length}행만 표시합니다.</p>
          <table>
            <thead><tr><th>행</th><th>Task</th><th>이름</th><th>오류</th><th>경고</th></tr></thead>
            <tbody>
              {issueRows.map((row) => <tr className={row.errors.length ? "high-risk-row" : ""} key={row.row}>
                <td>{row.row}</td><td className="mono">{row.code}</td><td>{row.name}</td>
                <td>{row.errors.join(" / ") || "-"}</td><td>{row.warnings.join(" / ") || "-"}</td>
              </tr>)}
              {!report.rows.length && <tr><td colSpan={5} className="empty">읽을 수 있는 행이 없습니다.</td></tr>}
              {report.rows.length > 0 && !issueRows.length && <tr><td colSpan={5} className="empty">오류·경고 없이 전체 {report.rows.length}행 정상입니다.</td></tr>}
            </tbody>
          </table>
        </div>;
      })()}
    </section>

    {children}

    <section className="danger-zone">
      <div><strong>데이터 초기화</strong><p>프로젝트의 모든 WBS 항목이 보관 처리됩니다(목록·조회에서 제외, 복구 가능).</p>{resetMessage && <p className={resetMessage.includes("보관 처리") ? "form-success" : "form-error"} role="status">{resetMessage}</p>}</div>
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
