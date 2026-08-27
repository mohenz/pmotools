"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WeeklyReportDetail } from "@/lib/server/work-management";

async function jsonRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "요청 처리 중 오류가 발생했습니다.");
  return payload;
}

export function WeeklyReportDetailClient({ detail }: { detail: WeeklyReportDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function changeStatus(status: "open" | "closed") {
    const prompt = status === "closed" ? "PM 확인을 완료하면 리포트 입력이 잠깁니다. 계속하시겠습니까?" : "PM 확인을 취소하고 리포트를 다시 수정 가능하게 하시겠습니까?";
    if (!window.confirm(prompt)) return;
    setPending(true); setMessage("");
    try {
      await jsonRequest(`/api/v1/weekly-reports/${detail.id}/status`, "PATCH", { status });
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "상태를 변경하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <>
    <section className="panel weekly-report-summary">
      <div><span>실적 기간</span><strong>{detail.actualStart} ~ {detail.actualEnd}</strong></div>
      <div><span>계획 기간</span><strong>{detail.planStart} ~ {detail.planEnd}</strong></div>
      <div><span>작성 현황</span><strong>{detail.completedCount} / {detail.moduleCount}개 모듈</strong></div>
      <div><span>상태</span><strong className={`weekly-status ${detail.status}`}>{detail.status === "closed" ? "PM 확인 완료" : "작성 중"}</strong></div>
    </section>
    <section className="panel weekly-report-detail-panel">
      <div className="table-wrap">
        <table className="weekly-report-table">
          <thead><tr><th>업무그룹</th><th>실적</th><th>계획</th><th>이슈 및 요청사항</th></tr></thead>
          <tbody>{detail.reports.map((report) => <tr key={report.id}>
            <th><Link href={`/weekly-reports/${detail.id}/reports/${report.areaCodeId}/edit`}>{report.areaLabel}</Link>{report.canEdit && <small>클릭하여 작성·수정</small>}</th>
            <td>{report.achievements || <span className="empty-value">미입력</span>}</td>
            <td>{report.nextPlan || <span className="empty-value">미입력</span>}</td>
            <td>{report.issues || <span className="empty-value">없음</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {message && <p className="form-error">{message}</p>}
      <div className="weekly-detail-actions">
        <button className="button secondary" type="button" onClick={() => router.push("/weekly-reports")}>목록으로</button>
        {detail.canManage && (detail.status === "open"
          ? <button className="button primary" type="button" disabled={pending} onClick={() => changeStatus("closed")}>PM 확인</button>
          : <button className="button secondary" type="button" disabled={pending} onClick={() => changeStatus("open")}>PM 확인 취소</button>)}
      </div>
    </section>

  </>;
}
