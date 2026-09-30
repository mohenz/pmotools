"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { MEETING_ACTION_STATUSES, meetingActionStatusLabel, meetingActionStatusTone, type MeetingActionStatus } from "@/lib/domain/meeting-action-items";
import type { MeetingActionItemLogRow } from "@/lib/server/meeting-action-items";

const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));

/** 상태 배지 + [변경] — 대화상자에서 새 상태·메모를 저장하고 지금까지의 변경 이력을 함께 본다. 프로젝트 멤버 누구나 변경 가능. */
export function MeetingActionStatusControl({ id, title, status }: { id: string; title: string; status: MeetingActionStatus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<MeetingActionStatus>(status);
  const [memo, setMemo] = useState("");
  const [logs, setLogs] = useState<MeetingActionItemLogRow[] | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");

  async function openDialog(value: boolean) {
    setOpen(value);
    if (!value) return;
    setNext(status); setMemo(""); setError(""); setLogs(null);
    const response = await fetch(`/api/v1/meeting-action-items/${id}/logs`);
    const payload = await response.json().catch(() => null);
    setLogs(response.ok ? payload.data : []);
  }

  async function save() {
    if (next === status) { setError("변경할 상태를 선택해 주세요."); return; }
    setSaving(true); setError("");
    const response = await fetch(`/api/v1/meeting-action-items/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next, fromStatus: status, memo }) });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) { setError(payload?.error?.message ?? "상태를 변경하지 못했습니다."); return; }
    setOpen(false);
    router.refresh();
  }

  return <Dialog.Root open={open} onOpenChange={openDialog}>
    <span className="action-status-cell">
      <span className={`badge ${meetingActionStatusTone(status)}`}>{meetingActionStatusLabel(status)}</span>
      <Dialog.Trigger asChild><button className="button secondary small" type="button" aria-label={`${title} 상태 변경·이력`}>변경</button></Dialog.Trigger>
    </span>
    <Dialog.Portal>
      <Dialog.Overlay className="calendar-modal-backdrop" />
      <Dialog.Content className="alert-dialog action-status-dialog">
        <Dialog.Title asChild><h2>Action Item 상태 변경</h2></Dialog.Title>
        <Dialog.Description asChild><p>{title}</p></Dialog.Description>
        <fieldset className="action-status-options">
          <legend>상태 (현재: {meetingActionStatusLabel(status)})</legend>
          {MEETING_ACTION_STATUSES.map((option) => <label key={option.value}>
            <input type="radio" name={`status-${id}`} value={option.value} checked={next === option.value} onChange={() => setNext(option.value)} />
            <span className={`badge ${option.tone}`}>{option.label}</span>
          </label>)}
        </fieldset>
        <label className="action-status-memo">변경 메모 (선택)<textarea value={memo} maxLength={500} onChange={(event) => setMemo(event.target.value)} placeholder="예: 협력사 회신 대기로 보류" /></label>
        {error && <p className="critical" role="alert">{error}</p>}
        <div className="alert-dialog-actions">
          <Dialog.Close asChild><button className="button secondary" type="button">닫기</button></Dialog.Close>
          <button className="button primary" type="button" onClick={save} disabled={saving || next === status}>{saving ? "저장 중…" : "저장"}</button>
        </div>
        <h3 className="action-status-log-title">변경 이력</h3>
        {logs === null ? <p>불러오는 중…</p> : logs.length ? <ol className="action-status-logs">{logs.map((log) => <li key={log.id}>
          <span className="mono">{dateTime(log.createdAt)}</span> <strong>{log.actorName}</strong> {log.fromStatus ? meetingActionStatusLabel(log.fromStatus) : "-"} → {meetingActionStatusLabel(log.toStatus)}
          {log.memo && <div className="action-status-log-memo">{log.memo}</div>}
        </li>)}</ol> : <p>변경 이력이 없습니다.</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
