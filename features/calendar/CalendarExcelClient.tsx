"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { ImportReport } from "@/lib/server/calendar-excel";

function currentMonth() { return new Date().toISOString().slice(0, 7); }

export function CalendarExcelClient() {
  const [month, setMonth] = useState(currentMonth());
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function validate(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setPending("validate"); setMessage(""); setReport(null);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/calendar-events/excel/import/validate", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "검증에 실패했습니다."); return; }
    setReport(payload.data);
  }
  async function apply() {
    if (!file) return;
    setPending("apply"); setMessage("");
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/v1/calendar-events/excel/import", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "반영에 실패했습니다."); if (payload?.data) setReport(payload.data); return; }
    setMessage(`${payload.data.applied}건을 반영했습니다.`);
    setReport(null); setFile(null);
  }

  const canApply = report && report.errorCount === 0 && report.validCount > 0;

  return <>
    <header className="topbar"><div><h1>캘린더 엑셀 업/다운로드</h1><p>월단위로 일정을 엑셀로 내려받거나, 표준 서식으로 대량 등록/수정합니다.</p></div><Link className="button secondary" href="/calendar">캘린더로</Link></header>
    <div className="content">
      <section className="panel">
        <div className="panel-head"><h2>다운로드</h2></div>
        <div className="inline-create">
          <label>대상 월<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          <a className="button primary" href={`/api/v1/calendar-events/excel/export?month=${month}`}>엑셀 다운로드</a>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><h2>업로드</h2><span>ID 열이 비어있으면 신규 등록, 채워져 있으면 해당 일정을 수정합니다.</span></div>
        <form className="inline-create" onSubmit={validate}>
          <label>엑셀 파일<input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }} required /></label>
          <button className="button secondary" type="submit" disabled={!file || !!pending}>{pending === "validate" ? "검증 중…" : "검증(Dry-run)"}</button>
          {canApply && <button className="button primary" type="button" onClick={apply} disabled={!!pending}>{pending === "apply" ? "반영 중…" : `반영 (${report.validCount}건)`}</button>}
        </form>
        {message && <p className={message.includes("반영했습니다") ? "form-success" : "form-error"} role="status">{message}</p>}
        {report && <div className="table-wrap">
          <table>
            <thead><tr><th>행</th><th>구분</th><th>제목</th><th>오류</th></tr></thead>
            <tbody>
              {report.rows.map((row) => <tr className={row.errors.length ? "high-risk-row" : ""} key={row.row}><td>{row.row}</td><td>{row.action === "create" ? "신규" : "수정"}</td><td>{row.title}</td><td>{row.errors.join(" / ") || "정상"}</td></tr>)}
              {!report.rows.length && <tr><td colSpan={4} className="empty">읽을 수 있는 행이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  </>;
}
