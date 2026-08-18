"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ProjectWeek, WeeklyReport } from "@/lib/server/work-management";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export function WeeklyReportManagementScreen({ reports, weeks, selectedWeek }: { reports: WeeklyReport[]; weeks: ProjectWeek[]; selectedWeek: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(report: WeeklyReport) {
    setPendingId(report.id); setError("");
    const response = await fetch(`/api/v1/weekly-reports/${report.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "위클리리포트를 삭제하지 못했습니다.");
      setPendingId(null); return;
    }
    router.refresh(); setPendingId(null);
  }

  return <>
    <header className="topbar"><div><h1>위클리리포트 관리</h1><p>등록된 위클리리포트를 조회하고 삭제합니다.</p></div><div className="topbar-actions"><Link className="button secondary" href="/weekly-reports">리포트 입력 화면</Link></div></header>
    <div className="content settings-content">
      <form className="filters requirement-filter-panel weekly-report-admin-filter" method="get">
        <select name="week" defaultValue={selectedWeek} aria-label="프로젝트 주차"><option value="">전체 주차</option>{weeks.map((week) => <option value={week.id} key={week.id}>{week.label}</option>)}</select>
        <button className="button secondary" type="submit">조회</button>
      </form>
      <section className="panel"><div className="panel-head"><h2>위클리리포트 목록</h2><span>{reports.length}건</span></div>
        {error && <p className="form-error weekly-report-admin-error" role="alert">{error}</p>}
        {reports.length ? <div className="table-wrap"><table className="dense-table"><thead><tr><th>주차</th><th>업무영역</th><th>작성자</th><th>금주 실적</th><th>차주 계획</th><th>최종 수정</th><th>관리</th></tr></thead><tbody>
          {reports.map((report) => <tr key={report.id}><td>{report.weekLabel}</td><td><strong>{report.areaLabel}</strong></td><td>{report.creatorName}</td><td className="weekly-report-admin-summary">{report.achievements || "-"}</td><td className="weekly-report-admin-summary">{report.nextPlan || "-"}</td><td>{dateTime(report.updatedAt)}</td><td><div className="table-actions"><Link className="button secondary small" href={`/weekly-reports?edit=${report.id}`}>수정</Link><AlertDialog.Root><AlertDialog.Trigger asChild><button className="button danger small" type="button" disabled={pendingId === report.id}>{pendingId === report.id ? "삭제 중…" : "삭제"}</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="alert-overlay"/><AlertDialog.Content className="alert-dialog"><AlertDialog.Title>{report.weekLabel} · {report.areaLabel} 리포트 삭제</AlertDialog.Title><AlertDialog.Description>삭제한 위클리리포트는 복구할 수 없습니다. 계속하시겠습니까?</AlertDialog.Description><div className="alert-actions"><AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="button danger" type="button" onClick={() => remove(report)}>삭제</button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root></div></td></tr>)}
        </tbody></table></div> : <div className="empty">조회된 위클리리포트가 없습니다.</div>}
      </section>
    </div>
  </>;
}
