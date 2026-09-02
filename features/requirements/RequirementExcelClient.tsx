"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ImportReport } from "@/lib/server/requirements-excel";

export function RequirementExcelClient() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFile(picked: File | null) {
    if (picked && !picked.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("xlsx 파일만 업로드할 수 있습니다.");
      return;
    }
    setMessage("");
    setFile(picked);
    setReport(null);
  }
  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const dropped = event.dataTransfer.files;
    if (!dropped.length) return;
    if (fileInputRef.current) fileInputRef.current.files = dropped;
    pickFile(dropped[0]);
  }

  async function validate(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending("validate"); setMessage(""); setReport(null);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/requirements/excel/import/validate", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "검증에 실패했습니다."); return; }
    setReport(payload.data);
  }
  async function apply() {
    if (!file) return;
    setPending("apply"); setMessage("");
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/requirements/excel/import", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "반영에 실패했습니다."); if (payload?.data) setReport(payload.data); return; }
    setMessage(`${payload.data.applied}건을 반영했습니다.`);
    setReport(null); setFile(null);
  }

  const canApply = report && report.errorCount === 0 && report.validCount > 0;

  return <>
    <header className="topbar"><div><h1>요구사항 엑셀 업/다운로드</h1><p>요구사항정의서를 엑셀로 내려받거나, 표준 서식으로 대량 등록/수정합니다.</p></div><Link className="button secondary" href="/requirements">요구사항정의서로</Link></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>다운로드</h2></div>
        <a className="button primary" href="/api/v1/requirements/excel/export">엑셀 다운로드</a>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>업로드</h2><span>반영 시 현재 등록된 요구사항을 전부 삭제하고 파일 내용으로 새로 등록합니다(전체교체).</span></div>
        <form className="excel-upload-form" onSubmit={validate}>
          <label
            className={`file-dropzone${dragActive ? " drag-active" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} required />
            <span className="file-dropzone-icon" aria-hidden>⇪</span>
            <span className="file-dropzone-text">{file ? file.name : "엑셀 파일을 여기로 끌어다 놓거나 클릭해서 선택하세요"}</span>
            <span className="file-dropzone-hint">.xlsx 파일만 지원</span>
          </label>
          <div className="form-actions">
            <button className="button secondary" type="submit" disabled={!file || !!pending}>{pending === "validate" ? "검증 중…" : "검증(Dry-run)"}</button>
            {canApply && <AlertDialog.Root>
              <AlertDialog.Trigger asChild><button className="button primary" type="button" disabled={!!pending}>{pending === "apply" ? "반영 중…" : `반영 (${report.validCount}건)`}</button></AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="calendar-modal-backdrop" />
                <AlertDialog.Content className="alert-dialog">
                  <AlertDialog.Title asChild><h2>현재 등록된 요구사항 전체를 삭제하고 새로 등록하시겠습니까?</h2></AlertDialog.Title>
                  <AlertDialog.Description asChild><p>기존 요구사항과 그에 딸린 변경요청·이력이 모두 삭제되며, 되돌릴 수 없습니다. 이 파일에 담긴 {report.validCount}건으로 전체가 교체됩니다.</p></AlertDialog.Description>
                  <div className="alert-dialog-actions">
                    <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
                    <AlertDialog.Action asChild><button className="button danger" type="button" onClick={apply}>전체교체 반영</button></AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>}
          </div>
        </form>
        {message && <p className={message.includes("반영했습니다") ? "form-success" : "form-error"} role="status">{message}</p>}
        {report && <div className="table-wrap">
          <table>
            <thead><tr><th>행</th><th>요구사항명</th><th>오류</th><th>주의</th></tr></thead>
            <tbody>
              {report.rows.map((row) => <tr className={row.errors.length ? "high-risk-row" : ""} key={row.row}><td>{row.row}</td><td>{row.title}</td><td>{row.errors.join(" / ") || "정상"}</td><td>{row.warnings.join(" / ") || "-"}</td></tr>)}
              {!report.rows.length && <tr><td colSpan={4} className="empty">읽을 수 있는 행이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  </>;
}
