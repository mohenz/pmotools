"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Recurring = { id: string; applicantId: string; patternType: string; startMinutes: number; endMinutes: number; periodStart: string; periodEnd: string; purpose: string; status: string; rejectReason: string | null; room: { name: string }; applicant: { name: string; department: string | null } };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const api = async (url: string, init?: RequestInit) => { const response = await fetch(url, init), body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다."); return body.data; };

export function RecurringApprovalScreen({ initialRecurring }: { initialRecurring: Recurring[] }) {
  const router = useRouter();
  const [recurring, setRecurring] = useState(initialRecurring);
  const [message, setMessage] = useState("");

  async function review(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? prompt("반려 사유") ?? "" : "";
    if (action === "reject" && !reason.trim()) return;
    try {
      await api(`/api/v1/recurring-meetings/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) });
      setRecurring(await api("/api/v1/recurring-meetings"));
      router.refresh();
      setMessage("처리되었습니다.");
    } catch (err) { setMessage((err as Error).message); }
  }

  return <>
    <header className="topbar"><div><h1>정기예약 승인</h1><p>회의실 정기예약 신청을 검토하고 승인·반려합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="action-message" role="status">{message}</p>}
      <section className="panel">
        <div className="panel-head"><h2>신청 목록</h2><span>{recurring.length}건</span></div>
        <div className="meeting-list">
          {recurring.map((r) => <article key={r.id}>
            <div><strong>{r.room.name} · {r.applicant.name}{r.applicant.department ? ` (${r.applicant.department})` : ""}</strong><p>{r.patternType} · {hhmm(r.startMinutes)}–{hhmm(r.endMinutes)} · {r.periodStart}~{r.periodEnd} · {r.purpose} · {r.status}{r.status === "REJECTED" && r.rejectReason ? ` · 사유: ${r.rejectReason}` : ""}</p></div>
            {r.status === "PENDING" && <div><button className="button primary" onClick={() => review(r.id, "approve")}>승인</button> <button className="button danger" onClick={() => review(r.id, "reject")}>반려</button></div>}
          </article>)}
          {!recurring.length && <p className="empty">신청된 정기예약이 없습니다.</p>}
        </div>
      </section>
    </div>
  </>;
}
