"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PersonPicker } from "@/components/PersonPicker";
import { WarningDialog } from "@/components/WarningDialog";
import { meetingMinuteFileName, type MeetingSession } from "@/lib/domain/meeting-minutes";
import type { MeetingMinuteActionItemRow, MeetingMinuteAttendeeRow, MeetingMinuteDraft, MeetingMinuteEntryRow } from "@/lib/server/meeting-minutes";
import type { ProjectMemberOption } from "@/lib/server/users";

type Side = "CUSTOMER" | "VENDOR";
type PickerState = { ids: string[]; names: string[] };

const BLANK_ENTRY: MeetingMinuteEntryRow = { content: "", remark: "", plannedSchedule: "" };
const BLANK_ACTION: MeetingMinuteActionItemRow = { title: "", content: "", assigneeId: null, assigneeName: "", dueDate: "" };
const atLeastOne = <T,>(rows: T[], blank: T) => (rows.length ? rows : [blank]);

function pickerOf(attendees: MeetingMinuteAttendeeRow[], side: Side): PickerState {
  const rows = attendees.filter((a) => a.side === side);
  return { ids: rows.flatMap((a) => (a.userId ? [a.userId] : [])), names: rows.flatMap((a) => (a.userId ? [] : [a.name])) };
}

export function MeetingMinuteFormScreen({ initial, members, minuteId, version }: { initial: MeetingMinuteDraft; members: ProjectMemberOption[]; minuteId?: string; version?: number }) {
  const router = useRouter();
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const [category, setCategory] = useState(initial.category);
  const [title, setTitle] = useState(initial.title);
  const [meetingDate, setMeetingDate] = useState(initial.meetingDate);
  const [sessions, setSessions] = useState<MeetingSession[]>(atLeastOne(initial.sessions, { start: "09:00", end: "10:00" }));
  const [location, setLocation] = useState(initial.location);
  const [authorName, setAuthorName] = useState(initial.authorName);
  const [customer, setCustomer] = useState<PickerState>(pickerOf(initial.attendees, "CUSTOMER"));
  const [vendor, setVendor] = useState<PickerState>(pickerOf(initial.attendees, "VENDOR"));
  const [contents, setContents] = useState(atLeastOne(initial.contents, BLANK_ENTRY));
  const [decisions, setDecisions] = useState(atLeastOne(initial.decisions, BLANK_ENTRY));
  const [actionItems, setActionItems] = useState(atLeastOne(initial.actionItems, BLANK_ACTION));
  const [notes, setNotes] = useState(atLeastOne(initial.notes, BLANK_ENTRY));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");

  const toAttendees = (side: Side, state: PickerState): MeetingMinuteAttendeeRow[] => [
    ...state.ids.map((id) => ({ side, userId: id, name: memberName.get(id) ?? "" })).filter((a) => a.name),
    ...state.names.map((name) => ({ side, userId: null, name })),
  ];
  // 담당자는 자유 입력이다 — 이름이 프로젝트 멤버 한 명과 정확히 일치할 때만 사용자로 연결한다(동명이인은 연결하지 않음).
  const resolveAssignee = (name: string) => { const matches = members.filter((m) => m.name === name.trim()); return matches.length === 1 ? matches[0].id : null; };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const body = {
      category, title, meetingDate, sessions, location, authorName,
      attendees: [...toAttendees("CUSTOMER", customer), ...toAttendees("VENDOR", vendor)],
      contents, decisions, notes,
      actionItems: actionItems.map((item) => ({ ...item, assigneeId: resolveAssignee(item.assigneeName) })),
      ...(minuteId ? { version } : {}),
    };
    const response = await fetch(minuteId ? `/api/v1/meeting-minutes/${minuteId}` : "/api/v1/meeting-minutes", { method: minuteId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const fieldMessage = payload?.error?.fieldErrors ? Object.values(payload.error.fieldErrors as Record<string, string[]>).flat()[0] : undefined;
      setError(fieldMessage ?? payload?.error?.message ?? "저장하지 못했습니다."); setSaving(false); return;
    }
    router.push(`/meeting-minutes/${payload.data.id}`); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>{minuteId ? "회의록 수정" : "회의록 작성"}</h1><p>파일명: {meetingMinuteFileName(meetingDate, category, title || "회의 안건")}</p></div></header>
    <div className="content"><section className="panel form-panel minute-form-panel"><form onSubmit={submit} className="minute-form">
      <h2 className="minute-form-title">기본 정보</h2>
      <div className="form-grid">
        <label>분류<input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={20} placeholder="예: DES" /></label>
        <label>회의 일자<input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required /></label>
      </div>
      <label>회의 안건<input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="예: 상품전시 내부리뷰" /></label>
      <fieldset><legend>회의 시간</legend>
        <div className="minute-sessions">{sessions.map((session, index) => <div className="minute-session" key={index}>
          <input type="time" value={session.start} onChange={(e) => setSessions(update(sessions, index, { ...session, start: e.target.value }))} required aria-label={`${index + 1}회차 시작`} />
          <span>~</span>
          <input type="time" value={session.end} onChange={(e) => setSessions(update(sessions, index, { ...session, end: e.target.value }))} required aria-label={`${index + 1}회차 종료`} />
          {sessions.length > 1 && <button type="button" className="button ghost" onClick={() => setSessions(remove(sessions, index))}>삭제</button>}
        </div>)}
          <button type="button" className="button secondary" onClick={() => setSessions([...sessions, { start: "13:00", end: "14:00" }])}>+ 시간대 추가</button></div>
      </fieldset>
      <div className="form-grid">
        <label>회의 장소<input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="예: 퍼시픽타워 22층 대회의실" /></label>
        <label>작성자<input value={authorName} onChange={(e) => setAuthorName(e.target.value)} required maxLength={50} /></label>
      </div>
      <div className="form-grid">
        <div><span className="field-label">참석자 · 발주사</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={customer.ids} selectedNames={customer.names} onChange={(ids, names) => setCustomer({ ids, names })} /></div></div>
        <div><span className="field-label">참석자 · 수행사 <small>(조직·역할명도 직접 입력 가능)</small></span><div className="attendee-picker"><PersonPicker people={members} selectedIds={vendor.ids} selectedNames={vendor.names} onChange={(ids, names) => setVendor({ ids, names })} /></div></div>
      </div>

      <RowEditor title="회의 내용" rows={contents} blank={BLANK_ENTRY} onChange={setContents} stacked columns={[{ key: "content", label: "내용" }, { key: "remark", label: "이슈/비고" }]} />
      <RowEditor title="결정사항" rows={decisions} blank={BLANK_ENTRY} onChange={setDecisions} stacked columns={[{ key: "content", label: "내용" }, { key: "plannedSchedule", label: "진행 예정 일정" }]} />
      <RowEditor title="Action Item" rows={actionItems} blank={BLANK_ACTION} onChange={setActionItems} columns={[{ key: "title", label: "Action Item" }, { key: "content", label: "내용" }, { key: "assigneeName", label: "담당자", list: "minute-members" }, { key: "dueDate", label: "Due Date", type: "date" }]} />
      <datalist id="minute-members">{members.map((m) => <option value={m.name} key={m.id} />)}</datalist>
      <RowEditor title="특이 사항" rows={notes} blank={BLANK_ENTRY} onChange={setNotes} columns={[{ key: "content", label: "내용", multiline: true }]} />

      <WarningDialog message={error} onClose={() => setError("")} />
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={() => router.back()}>취소</button>
        <button className="button primary" type="submit" disabled={saving}>{saving ? "저장 중…" : minuteId ? "수정 저장" : "등록하기"}</button>
      </div>
    </form></section></div>
  </>;
}

const update = <T,>(rows: T[], index: number, value: T) => rows.map((row, i) => (i === index ? value : row));
const remove = <T,>(rows: T[], index: number) => rows.filter((_, i) => i !== index);

type Column<T> = { key: keyof T & string; label: string; multiline?: boolean; type?: "date"; list?: string };

// stacked: 항목(내용·이슈/비고 등)을 옆으로 나란히 두지 않고 세로로 배치하며, 각 입력란은 한 줄 입력의 3배 높이(120px) 여러 줄 입력칸이다(회의 내용·결정사항).
function RowEditor<T extends Record<string, unknown>>({ title, rows, blank, onChange, columns, stacked = false }: { title: string; rows: T[]; blank: T; onChange: (rows: T[]) => void; columns: Column<T>[]; stacked?: boolean }) {
  const field = (row: T, index: number, c: Column<T>) => <input type={c.type ?? "text"} list={c.list} value={String(row[c.key] ?? "")} onChange={(e) => onChange(update(rows, index, { ...row, [c.key]: e.target.value }))} aria-label={`${title} ${index + 1} ${c.label}`} />;
  return <fieldset className="minute-rows"><legend>{title} <small>빈 행은 저장되지 않습니다</small></legend>
    <div className="table-wrap"><table className={stacked ? "minute-rows-stacked" : undefined}><thead><tr><th className="minute-row-no">#</th>{stacked ? <th>{columns.map((c) => c.label).join(" · ")}</th> : columns.map((c) => <th key={c.key}>{c.label}</th>)}<th className="minute-row-actions" aria-label="행 관리" /></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>
        <td className="minute-row-no">{index + 1}</td>
        {stacked ? <td><div className="minute-stack">{columns.map((c) => <label key={c.key}><span>{c.label}</span><textarea value={String(row[c.key] ?? "")} onChange={(e) => onChange(update(rows, index, { ...row, [c.key]: e.target.value }))} aria-label={`${title} ${index + 1} ${c.label}`} /></label>)}</div></td>
        : columns.map((c) => <td key={c.key}>{c.multiline
          ? <textarea rows={2} value={String(row[c.key] ?? "")} onChange={(e) => onChange(update(rows, index, { ...row, [c.key]: e.target.value }))} aria-label={`${title} ${index + 1} ${c.label}`} />
          : field(row, index, c)}</td>)}
        <td className="minute-row-actions">
          <button type="button" className="button ghost" disabled={index === 0} onClick={() => onChange(rows.map((r, i) => (i === index - 1 ? rows[index] : i === index ? rows[index - 1] : r)))} aria-label="위로">↑</button>
          <button type="button" className="button ghost" onClick={() => onChange(rows.length > 1 ? remove(rows, index) : [blank])} aria-label="행 삭제">삭제</button>
        </td>
      </tr>)}</tbody></table></div>
    <button type="button" className="button secondary" onClick={() => onChange([...rows, blank])}>+ 행 추가</button>
  </fieldset>;
}
