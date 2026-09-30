"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTimePicker } from "@/components/DateTimePicker";
import { WarningDialog } from "@/components/WarningDialog";

type Room = { id: string; name: string };
type Applicant = { id: string; name: string; department: string | null };
type Recurring = { id: string; applicantId: string; roomId: string; patternType: string; patternDetail: { daysOfWeek?: number[]; dayOfMonth?: number }; startMinutes: number; endMinutes: number; periodStart: string; periodEnd: string; purpose: string; status: string; rejectReason: string | null; room: { name: string }; applicant: { name: string; department: string | null } };
type Result = { rows: Recurring[]; total: number; page: number; pageSize: number; totalPages: number };
type Filters = { status: string; roomId: string; applicantId: string; page: number; pageSize: number };

const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려", CANCELLED: "삭제" };
const WEEKDAYS: [number, string][] = [[1, "월"], [2, "화"], [3, "수"], [4, "목"], [5, "금"], [6, "토"], [7, "일"]];
// 관리자 변경은 09~19시/30분 단위 제한을 받지 않으므로, 시간 선택지도 하루 전체(00~23시)와
// 10분 단위까지 열어 서버 검증(assertRecurringTimeManaged)과 UI가 어긋나지 않게 한다.
const MANAGED_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MANAGED_MINUTES = ["00", "10", "20", "30", "40", "50"];

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
const api = async (url: string, init?: RequestInit) => { const response = await fetch(url, init), body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다."); return body.data; };
function queryString(filters: Filters, overrides: Record<string, string | number | undefined> = {}) { const p = new URLSearchParams(); Object.entries({ ...filters, ...overrides }).forEach(([key, value]) => { if (value !== "" && value != null && !(key === "page" && value === 1) && !(key === "pageSize" && value === 20)) p.set(key, String(value)); }); return p.toString(); }

// r.periodStart/periodEnd는 API에서 Date가 JSON 직렬화된 전체 ISO 문자열("2026-10-01T00:00:00.000Z")로
// 넘어오므로, 그대로 이어붙이면 "T"가 중복되어 시:분 슬라이싱이 깨진다 — 날짜 부분만 잘라내 사용한다.
function detailToStrings(r: Recurring) {
  return { startAt: `${r.periodStart.slice(0, 10)}T${hhmm(r.startMinutes)}`, endAt: `${r.periodEnd.slice(0, 10)}T${hhmm(r.endMinutes)}` };
}

function EditForm({ rooms, target, onCancel, onSaved, setMessage }: { rooms: Room[]; target: Recurring; onCancel: () => void; onSaved: () => void; setMessage: (s: string) => void }) {
  const detail = target.patternDetail;
  const [patternType, setPatternType] = useState<"WEEKLY" | "DAILY" | "MONTHLY">(target.patternType as "WEEKLY" | "DAILY" | "MONTHLY");
  const initial = detailToStrings(target);
  const [startAt, setStartAt] = useState(initial.startAt), [endAt, setEndAt] = useState(initial.endAt), [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/v1/recurring-meetings/${target.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId: form.get("roomId"), patternType: form.get("patternType"), daysOfWeek: form.getAll("days").map(Number), dayOfMonth: Number(form.get("dayOfMonth")) || undefined, startMinutes: toMinutes(startAt.slice(11, 16)), endMinutes: toMinutes(endAt.slice(11, 16)), periodStart: startAt.slice(0, 10), periodEnd: endAt.slice(0, 10), purpose: form.get("purpose") }),
      });
      setMessage("정기예약이 변경되었습니다."); onSaved();
    } catch (err) { setMessage((err as Error).message); } finally { setSaving(false); }
  }

  return <form className="panel meeting-form recurring-edit-form" onSubmit={submit}>
    <h2>정기예약 변경 — {target.room.name} · {target.applicant.name}</h2>
    <label>회의실<select name="roomId" defaultValue={target.roomId}>{rooms.map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
    <label>반복<select name="patternType" value={patternType} onChange={(e) => setPatternType(e.target.value as "WEEKLY" | "DAILY" | "MONTHLY")}><option value="WEEKLY">매주</option><option value="DAILY">매일</option><option value="MONTHLY">매월</option></select></label>
    {patternType === "WEEKLY" && <fieldset className="weekday-picker"><legend>요일</legend>{WEEKDAYS.map(([d, label]) => <label className="check" key={d}><input type="checkbox" name="days" value={d} defaultChecked={detail?.daysOfWeek?.includes(d)} />{label}</label>)}</fieldset>}
    {patternType === "MONTHLY" && <label>매월 일자<input name="dayOfMonth" type="number" min="1" max="31" defaultValue={detail?.dayOfMonth} /></label>}
    <div className="form-grid two"><DateTimePicker label="시작일시" value={startAt} onChange={setStartAt} hours={MANAGED_HOURS} minutes={MANAGED_MINUTES} /><DateTimePicker label="종료일시" value={endAt} onChange={setEndAt} hours={MANAGED_HOURS} minutes={MANAGED_MINUTES} /></div>
    <label>목적<input name="purpose" defaultValue={target.purpose} required /></label>
    <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel} disabled={saving}>취소</button><button className="button primary" disabled={saving}>{saving ? "저장 중…" : "변경 저장"}</button></div>
  </form>;
}

export function RecurringManagementScreen({ result, filters, rooms, applicants }: { result: Result; filters: Filters; rooms: Room[]; applicants: Applicant[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function review(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? prompt("반려 사유") ?? "" : "";
    if (action === "reject" && !reason.trim()) return;
    try { await api(`/api/v1/recurring-meetings/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, reason }) }); setMessage("처리되었습니다."); router.refresh(); }
    catch (err) { setMessage((err as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("이 정기예약을 삭제할까요? 승인된 예약이라면 이미 생성된 개별 예약도 함께 취소됩니다.")) return;
    try { await api(`/api/v1/recurring-meetings/${id}`, { method: "DELETE" }); setMessage("삭제되었습니다."); router.refresh(); }
    catch (err) { setMessage((err as Error).message); }
  }

  const editingTarget = result.rows.find((r) => r.id === editingId) ?? null;
  const pageLinkCount = Math.min(10, result.totalPages);
  const firstPage = Math.max(1, Math.min(result.page - 4, result.totalPages - pageLinkCount + 1));
  const pageNumbers = Array.from({ length: pageLinkCount }, (_, index) => firstPage + index);

  return <>
    <header className="topbar"><div><h1>정기예약 관리</h1><p>총 {result.total}건 · 회의실 정기예약 신청을 승인·반려하고, 등록된 정기예약을 변경·삭제합니다.</p></div></header>
    <div className="content settings-content">
      {message && <p className="action-message" role="status">{message}</p>}
      {editingTarget && <EditForm rooms={rooms} target={editingTarget} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); router.refresh(); }} setMessage={setMessage} />}

      <form className="filters inline-filter recurring-meeting-filters" method="get">
        {filters.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(filters.pageSize)} />}
        <select name="status" defaultValue={filters.status} aria-label="상태"><option value="">전체 상태</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select name="roomId" defaultValue={filters.roomId} aria-label="회의실"><option value="">전체 회의실</option>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select>
        <select name="applicantId" defaultValue={filters.applicantId} aria-label="신청자"><option value="">전체 신청자</option>{applicants.map((applicant) => <option value={applicant.id} key={applicant.id}>{applicant.name}{applicant.department ? ` (${applicant.department})` : ""}</option>)}</select>
        <button className="button primary">조회</button>
        <Link className="button secondary" href="/settings/recurring-meetings">초기화</Link>
      </form>

      <section className="panel">
        <div className="panel-head"><h2>정기예약 목록</h2><span>{result.total}건</span></div>
        <div className="meeting-list">
          {result.rows.map((r) => <article key={r.id}>
            <div><strong>{r.room.name} · {r.applicant.name}{r.applicant.department ? ` (${r.applicant.department})` : ""}</strong><p>{r.patternType} · {hhmm(r.startMinutes)}–{hhmm(r.endMinutes)} · {r.periodStart.slice(0, 10)}~{r.periodEnd.slice(0, 10)} · {r.purpose} · {STATUS_LABEL[r.status] ?? r.status}{r.status === "REJECTED" && r.rejectReason ? ` · 사유: ${r.rejectReason}` : ""}</p></div>
            <div>
              {r.status === "PENDING" && <><button className="button primary" onClick={() => review(r.id, "approve")}>승인</button> <button className="button danger" onClick={() => review(r.id, "reject")}>반려</button> </>}
              {(r.status === "PENDING" || r.status === "APPROVED") && <><button className="button secondary" onClick={() => setEditingId(r.id)}>변경</button> <button className="button danger" onClick={() => remove(r.id)}>삭제</button></>}
            </div>
          </article>)}
          {!result.rows.length && <p className="empty">조건에 맞는 정기예약이 없습니다.</p>}
        </div>
      </section>

      {result.total > 0 && <nav className="pagination requirement-pagination" aria-label="페이지 이동">
        <form className="page-size-form" method="get">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          {filters.roomId && <input type="hidden" name="roomId" value={filters.roomId} />}
          {filters.applicantId && <input type="hidden" name="applicantId" value={filters.applicantId} />}
          <label>표시 개수<select name="pageSize" defaultValue={String(filters.pageSize)}><option value="20">20개</option><option value="40">40개</option><option value="60">60개</option><option value="80">80개</option><option value="100">100개</option></select></label>
          <button className="button secondary" type="submit">적용</button>
        </form>
        <div className="page-links">
          {result.page > 1 && <Link href={`/settings/recurring-meetings?${queryString(filters, { page: result.page - 1 })}`} aria-label="이전 페이지">이전</Link>}
          {pageNumbers.map((page) => page === result.page ? <strong className="current" aria-current="page" key={page}>{page}</strong> : <Link href={`/settings/recurring-meetings?${queryString(filters, { page })}`} key={page}>{page}</Link>)}
          {result.page < result.totalPages && <Link href={`/settings/recurring-meetings?${queryString(filters, { page: result.page + 1 })}`} aria-label="다음 페이지">다음</Link>}
        </div>
        <span className="page-summary">총 {result.total}건 · {result.page} / {result.totalPages} 페이지</span>
      </nav>}
    </div>
  </>;
}
