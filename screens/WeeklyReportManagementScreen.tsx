"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { WeeklyReportListResult, WeeklyReportSummary } from "@/lib/server/work-management";

function date(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function pageHref(page: number, q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/settings/weekly-reports${query ? `?${query}` : ""}`;
}

export function WeeklyReportManagementScreen({ result, q }: { result: WeeklyReportListResult; q: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(report: WeeklyReportSummary) {
    setPendingId(report.id);
    setError("");
    const response = await fetch(`/api/v1/weekly-reports/${report.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "위클리리포트를 삭제하지 못했습니다.");
      setPendingId(null);
      return;
    }
    router.refresh();
    setPendingId(null);
  }

  return <>
    <form className="filters requirement-filter-panel weekly-report-admin-filter" method="get">
      <input name="q" defaultValue={q} placeholder="리포트명·프로젝트명 검색" aria-label="검색어" />
      <button className="button secondary" type="submit">조회</button>
    </form>
    <section className="panel">
      <div className="panel-head"><h2>위클리리포트 목록</h2><span>{result.total}건</span></div>
      {error && <p className="form-error weekly-report-admin-error" role="alert">{error}</p>}
      {result.rows.length ? <div className="table-wrap"><table className="dense-table"><thead><tr><th>리포트명</th><th>금주 실적 기간</th><th>차주 계획 기간</th><th>작성 현황</th><th>상태</th><th>생성일</th><th>관리</th></tr></thead><tbody>
        {result.rows.map((report) => <tr key={report.id}>
          <td><strong>{report.reportName}</strong></td>
          <td>{report.actualStart} ~ {report.actualEnd}</td>
          <td>{report.planStart} ~ {report.planEnd}</td>
          <td>{report.completedCount} / {report.moduleCount}</td>
          <td><span className={`badge ${report.status === "closed" ? "success" : "warning"}`}>{report.status === "closed" ? "PM 확인" : "작성 중"}</span></td>
          <td>{date(report.createdAt)}</td>
          <td><div className="table-actions">
            <Link className="button secondary small" href={`/weekly-reports/${report.id}`}>상세</Link>
            <AlertDialog.Root><AlertDialog.Trigger asChild><button className="button danger small" type="button" disabled={pendingId === report.id}>{pendingId === report.id ? "삭제 중…" : "삭제"}</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="alert-overlay"/><AlertDialog.Content className="alert-dialog"><AlertDialog.Title>{report.reportName} 삭제</AlertDialog.Title><AlertDialog.Description>이 주차의 업무그룹별 위클리리포트가 모두 삭제됩니다. 주간실적·인력변동이 없으면 주차 정보도 함께 삭제되며, 연결 데이터가 있으면 주차 정보는 유지됩니다. 계속하시겠습니까?</AlertDialog.Description><div className="alert-actions"><AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="button danger" type="button" onClick={() => remove(report)}>삭제</button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>
          </div></td>
        </tr>)}
      </tbody></table></div> : <div className="empty">조회된 위클리리포트가 없습니다.</div>}
    </section>
    {result.pageCount > 1 && <nav className="pagination" aria-label="페이지 이동">
      {result.page > 1 ? <Link href={pageHref(result.page - 1, q)}>이전</Link> : <span />}
      <strong>{result.page} / {result.pageCount}</strong>
      {result.page < result.pageCount ? <Link href={pageHref(result.page + 1, q)}>다음</Link> : <span />}
    </nav>}
  </>;
}
