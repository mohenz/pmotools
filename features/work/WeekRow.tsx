"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ProjectWeek } from "@/lib/server/work-management";
import { WeekStatusButton } from "@/features/work/WeekStatusButton";

export function WeekRow({ week }: { week: ProjectWeek }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: week.label, startDate: week.startDate, endDate: week.endDate });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setPending(true); setMessage("");
    const response = await fetch(`/api/v1/weeks/${week.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "주차를 저장하지 못했습니다."); return; }
    setEditing(false);
    router.refresh();
  }
  function cancel() {
    setForm({ label: week.label, startDate: week.startDate, endDate: week.endDate });
    setEditing(false); setMessage("");
  }
  async function remove() {
    setPending(true); setMessage("");
    const response = await fetch(`/api/v1/weeks/${week.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "주차를 삭제하지 못했습니다."); return; }
    router.refresh();
  }

  return <tr>
    <td className="mono">{week.weekKey}</td>
    <td>{editing ? <input aria-label={`${week.weekKey} 주차명`} value={form.label} onChange={(event) => setForm((f) => ({ ...f, label: event.target.value }))} required maxLength={50} /> : week.label}</td>
    <td>{editing ? <input aria-label={`${week.weekKey} 시작일`} type="date" value={form.startDate} onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))} required /> : week.startDate}</td>
    <td>{editing ? <input aria-label={`${week.weekKey} 종료일`} type="date" value={form.endDate} onChange={(event) => setForm((f) => ({ ...f, endDate: event.target.value }))} required /> : week.endDate}</td>
    <td><span className={`badge ${week.status === "open" ? "level-pm" : ""}`}>{week.status === "open" ? "진행" : "마감"}</span></td>
    <td className="topbar-actions">
      {editing ? <>
        <button className="button secondary" type="button" disabled={pending} onClick={save}>{pending ? "저장 중…" : "저장"}</button>
        <button className="button secondary" type="button" disabled={pending} onClick={cancel}>취소</button>
      </> : <>
        <button className="button secondary" type="button" onClick={() => setEditing(true)}>수정</button>
        <WeekStatusButton id={week.id} status={week.status} />
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={pending}>삭제</button></AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="calendar-modal-backdrop" />
            <AlertDialog.Content className="alert-dialog">
              <AlertDialog.Title asChild><h2>{week.label} 주차를 삭제하시겠습니까?</h2></AlertDialog.Title>
              <AlertDialog.Description asChild><p>연결된 주간보고·실적·인력변동 데이터가 있으면 삭제할 수 없습니다.</p></AlertDialog.Description>
              <div className="alert-dialog-actions">
                <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
                <AlertDialog.Action asChild><button className="button danger" type="button" onClick={remove}>삭제</button></AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>}
      {message && <p className="form-error" style={{ width: "100%", marginTop: 4 }}>{message}</p>}
    </td>
  </tr>;
}
