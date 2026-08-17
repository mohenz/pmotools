"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CommonCode } from "@/lib/server/common-codes";
import type { CalendarEvent } from "@/lib/server/calendar";
import type { ProjectMemberOption } from "@/lib/server/users";
import { PersonPicker } from "@/components/PersonPicker";

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = ["00", "10", "20", "30", "40", "50"];
function localInput(value: string | undefined, fallback: string) { if (!value) return fallback; const d = new Date(value), pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function shifted(value: string, milliseconds: number) { const date = new Date(value); if (Number.isNaN(date.getTime())) return value; date.setTime(date.getTime() + milliseconds); const pad = (n: number) => String(n).padStart(2, "0"); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function replacePart(value: string, part: "date" | "hour" | "minute", next: string) { const date = value.slice(0, 10), hour = value.slice(11, 13), minute = value.slice(14, 16); if (part === "date") return `${next}T${hour}:${minute}`; if (part === "hour") return `${date}T${next}:${minute}`; return `${date}T${hour}:${next}`; }
function DateTimePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label>{label}<div className="calendar-time-picker"><input aria-label={`${label} 날짜`} type="date" value={value.slice(0, 10)} onChange={(e) => onChange(replacePart(value, "date", e.target.value))} required /><select aria-label={`${label} 시간`} value={value.slice(11, 13)} onChange={(e) => onChange(replacePart(value, "hour", e.target.value))}>{hours.map((hour) => <option value={hour} key={hour}>{hour}시</option>)}</select><select aria-label={`${label} 분`} value={value.slice(14, 16)} onChange={(e) => onChange(replacePart(value, "minute", e.target.value))}>{minutes.map((minute) => <option value={minute} key={minute}>{minute}분</option>)}</select></div></label>; }

function plusOneHour(time: string) { const [h, m] = time.split(":").map(Number); const total = (h * 60 + m + 60) % 1440; return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

export function CalendarEventForm({ areas, members, event, selectedDate, selectedTime, returnUrl, canWrite = true }: { areas: CommonCode[]; members: ProjectMemberOption[]; event?: CalendarEvent | null; selectedDate: string; selectedTime?: string; returnUrl: string; canWrite?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const startTime = selectedTime ?? "09:00";
  const initialStart = localInput(event?.startAt, `${selectedDate}T${startTime}`), initialEnd = localInput(event?.endAt, `${selectedDate}T${plusOneHour(startTime)}`);
  const [startAt, setStartAt] = useState(initialStart), [endAt, setEndAt] = useState(initialEnd);
  const [scope, setScope] = useState<"single" | "all">("single");
  const [repeatFreq, setRepeatFreq] = useState<"NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">(event?.isRecurring && !event.occurrenceDate ? "WEEKLY" : "NONE");
  const [repeatEndType, setRepeatEndType] = useState<"never" | "until" | "count">("count");
  const memberIds = new Set(members.map((m) => m.id));
  const [assigneeIds, setAssigneeIds] = useState<string[]>(event?.assignees.filter((a) => memberIds.has(a.id)).map((a) => a.id) ?? []);
  const [assigneeNames, setAssigneeNames] = useState<string[]>(event?.assignees.filter((a) => !memberIds.has(a.id)).map((a) => a.name) ?? []);
  const [groupTagIds, setGroupTagIds] = useState<string[]>(event?.groupTags.map((t) => t.id) ?? []);
  function toggle(list: string[], id: string, setList: (next: string[]) => void) { setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]); }
  function changeStart(next: string) { const currentDuration = Math.max(600000, new Date(endAt).getTime() - new Date(startAt).getTime() || 3600000); setStartAt(next); setEndAt(shifted(next, event ? currentDuration : 3600000)); }

  const isEditingOccurrence = Boolean(event?.isRecurring);
  const canEditSeries = !event || !event.occurrenceDate; // new event, or editing the master (not a single occurrence)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setPending(true); setMessage("");
    const d = new FormData(e.currentTarget), v = (n: string) => String(d.get(n) ?? "");
    const recurrence = repeatFreq !== "NONE" && canEditSeries ? { freq: repeatFreq, endType: repeatEndType, until: repeatEndType === "until" ? v("repeatUntil") : undefined, count: repeatEndType === "count" ? Number(v("repeatCount")) || 10 : undefined } : null;
    const body = { title: v("title"), description: v("description"), eventType: v("eventType"), startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), allDay: d.get("allDay") === "on", areaCodeId: v("areaCodeId") || null, location: v("location"), priority: v("priority"), isMilestone: d.get("isMilestone") === "on", recurrence, assigneeIds, assigneeNames, groupTagIds };
    const scopeParam = event?.isRecurring ? `?scope=${scope}` : "";
    const response = await fetch(event ? `/api/v1/calendar-events/${event.id}${scopeParam}` : "/api/v1/calendar-events", { method: event ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "일정을 저장하지 못했습니다."); return; }
    router.push(returnUrl); router.refresh();
  }
  async function remove() {
    if (!event) return;
    if (!window.confirm(event.isRecurring && scope === "single" ? "이 일정(1회차)만 삭제할까요?" : "일정을 삭제할까요?")) return;
    setPending(true); setMessage("");
    const scopeParam = event.isRecurring ? `?scope=${scope}` : "";
    const response = await fetch(`/api/v1/calendar-events/${event.id}${scopeParam}`, { method: "DELETE" });
    setPending(false);
    if (!response.ok) { const payload = await response.json().catch(() => null); setMessage(payload?.error?.message ?? "일정을 삭제하지 못했습니다."); return; }
    router.push(returnUrl); router.refresh();
  }

  return <form className="calendar-event-form" onSubmit={submit}>
    {!canWrite && <p className="form-error">조회 권한만 있습니다. 일정을 등록·수정하려면 운영자 이상 권한이 필요합니다.</p>}
    <fieldset disabled={!canWrite} style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
    {isEditingOccurrence && <label>수정 범위<select value={scope} onChange={(e) => setScope(e.target.value as "single" | "all")}><option value="single">이 일정만</option><option value="all">전체 반복 일정</option></select></label>}
    <div className="form-grid triple">
      <label>일정명<input name="title" defaultValue={event?.title} required maxLength={200} /></label>
      <label>유형<select name="eventType" defaultValue={event?.eventType ?? "work"}><option value="meeting">회의</option><option value="milestone">마일스톤</option><option value="work">업무</option><option value="other">기타</option></select></label>
      <label>관련 영역<select name="areaCodeId" defaultValue={event?.areaCodeId ?? ""}><option value="">전체</option>{areas.map((a) => <option value={a.id} key={a.id}>{a.label}</option>)}</select></label>
      <DateTimePicker label="시작일시" value={startAt} onChange={changeStart} />
      <DateTimePicker label="종료일시" value={endAt} onChange={setEndAt} />
      <label>장소<input name="location" defaultValue={event?.location} maxLength={200} /></label>
    </div>
    <div className="form-grid triple">
      <label>우선순위<select name="priority" defaultValue={event?.priority ?? "MEDIUM"}><option value="HIGH">상</option><option value="MEDIUM">중</option><option value="LOW">하</option></select></label>
      <label className="toggle"><input name="isMilestone" type="checkbox" defaultChecked={event?.isMilestone} /> 마일스톤으로 표시</label>
      {canEditSeries && <label>반복<select value={repeatFreq} onChange={(e) => setRepeatFreq(e.target.value as typeof repeatFreq)}><option value="NONE">반복 안함</option><option value="DAILY">매일</option><option value="WEEKLY">매주</option><option value="MONTHLY">매월</option><option value="YEARLY">매년</option></select></label>}
    </div>
    {canEditSeries && repeatFreq !== "NONE" && <div className="form-grid triple">
      <label>종료 조건<select value={repeatEndType} onChange={(e) => setRepeatEndType(e.target.value as typeof repeatEndType)}><option value="count">횟수 지정</option><option value="until">날짜 지정</option><option value="never">종료 없음</option></select></label>
      {repeatEndType === "count" && <label>반복 횟수<input name="repeatCount" type="number" min={1} max={365} defaultValue={10} required /></label>}
      {repeatEndType === "until" && <label>종료일<input name="repeatUntil" type="date" defaultValue={selectedDate} required /></label>}
    </div>}
    <div className="form-grid">
      <div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={assigneeIds} selectedNames={assigneeNames} onChange={(ids, names) => { setAssigneeIds(ids); setAssigneeNames(names); }} /></div></div>
      <div><span className="field-label">업무그룹 태그</span><div className="checkbox-chip-list">{areas.map((a) => <label className="checkbox-chip" key={a.id}><input type="checkbox" checked={groupTagIds.includes(a.id)} onChange={() => toggle(groupTagIds, a.id, setGroupTagIds)} /> {a.label}</label>)}</div></div>
    </div>
    <label className="toggle calendar-all-day"><input name="allDay" type="checkbox" defaultChecked={event?.allDay} /> 종일 일정</label>
    <label>설명<textarea name="description" rows={2} defaultValue={event?.description} /></label>
    </fieldset>
    {message && <p className="form-error">{message}</p>}
    <div className="topbar-actions">
      {canWrite && <button className="button primary" disabled={pending}>{pending ? "저장 중…" : event ? "일정 수정" : "일정 등록"}</button>}
      {event && <button className="button secondary" type="button" onClick={() => router.push(returnUrl)}>{canWrite ? "수정 취소" : "닫기"}</button>}
      {event && canWrite && <button className="button secondary" type="button" onClick={remove} disabled={pending}>삭제</button>}
    </div>
  </form>;
}
