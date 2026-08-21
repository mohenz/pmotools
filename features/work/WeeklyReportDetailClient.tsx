"use client";

import { FormEvent, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WeeklyReportDetail } from "@/lib/server/work-management";

type Report = WeeklyReportDetail["reports"][number];

async function jsonRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "요청 처리 중 오류가 발생했습니다.");
  return payload;
}

export function WeeklyReportDetailClient({ detail }: { detail: WeeklyReportDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Report | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing?.canEdit) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      await jsonRequest("/api/v1/weekly-reports", "POST", {
        weekId: editing.weekId,
        areaCodeId: editing.areaCodeId,
        achievements: String(form.get("achievements") ?? ""),
        nextPlan: String(form.get("nextPlan") ?? ""),
        issues: String(form.get("issues") ?? ""),
      });
      setEditing(null);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setPending(false); }
  }

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
          <thead><tr><th>업무모듈</th><th>실적</th><th>계획</th><th>이슈 및 요청사항</th></tr></thead>
          <tbody>{detail.reports.map((report) => <tr key={report.id}>
            <th><button type="button" onClick={() => { setMessage(""); setEditing(report); }}>{report.areaLabel}</button>{report.canEdit && <small>클릭하여 작성</small>}</th>
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

    <Dialog.Root open={Boolean(editing)} onOpenChange={(open) => { if (!open && !pending) setEditing(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="calendar-modal-backdrop" />
        <Dialog.Content className="calendar-modal weekly-report-modal" aria-describedby={undefined}>
          <header><div><Dialog.Title asChild><h2>{editing?.areaLabel} 위클리리포트</h2></Dialog.Title><p>각 항목은 최대 2,000자까지 입력할 수 있습니다.</p></div><Dialog.Close asChild><button type="button" aria-label="창 닫기" disabled={pending}><X aria-hidden="true" /></button></Dialog.Close></header>
          {editing && <form className="weekly-report-edit-form" onSubmit={save}>
            <label>실적<textarea name="achievements" rows={7} maxLength={2000} defaultValue={editing.achievements} readOnly={!editing.canEdit} /></label>
            <label>계획<textarea name="nextPlan" rows={7} maxLength={2000} defaultValue={editing.nextPlan} readOnly={!editing.canEdit} /></label>
            <label>이슈 및 요청사항<textarea name="issues" rows={5} maxLength={2000} defaultValue={editing.issues} readOnly={!editing.canEdit} /></label>
            {message && <p className="form-error">{message}</p>}
            <div className="modal-actions"><Dialog.Close asChild><button className="button secondary" type="button" disabled={pending}>닫기</button></Dialog.Close>{editing.canEdit && <button className="button primary" disabled={pending}>{pending ? "저장 중…" : "저장"}</button>}</div>
          </form>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
