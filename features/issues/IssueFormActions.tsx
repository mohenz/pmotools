"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { probabilities, type Probability } from "@/lib/domain/levels";
import { issueStatuses, issueStatusLabel } from "@/lib/domain/issues";
import type { CommonCode } from "@/lib/server/common-codes";
import type { IssueProgressRow, IssueRow } from "@/lib/server/issues";
import type { ProjectMemberOption } from "@/lib/server/users";
import { PersonPicker } from "@/components/PersonPicker";

type Options = { issueTypes: CommonCode[]; reportLines: CommonCode[] };
type IssueStatusValue = "OPEN" | "IN_PROGRESS" | "CLOSED";
const today = () => new Date().toISOString().slice(0, 10);

type SnapshotInitial = {
  entryDate: string; status: IssueStatusValue; categoryCodeId: string; title: string; description: string;
  importance: Probability; priority: Probability; dueAt: string; ownerUserId: string | null;
  responseContent: string; escalated: boolean; reportLineCodeIds: string[]; remark: string;
};

function entryToInitial(entry: IssueProgressRow): SnapshotInitial {
  return {
    entryDate: entry.entryDate.slice(0, 10), status: entry.status, categoryCodeId: entry.categoryCodeId, title: entry.title, description: entry.description,
    importance: entry.importance, priority: entry.priority, dueAt: entry.dueAt?.slice(0, 10) ?? "", ownerUserId: entry.ownerUserId,
    responseContent: entry.responseContent, escalated: entry.escalated, reportLineCodeIds: entry.reportLineCodeIds, remark: entry.remark,
  };
}
function issueToInitial(issue: IssueRow): SnapshotInitial {
  return {
    entryDate: today(), status: issue.status, categoryCodeId: issue.categoryCodeId, title: issue.title, description: issue.description,
    importance: issue.importance, priority: issue.priority, dueAt: issue.dueAt?.slice(0, 10) ?? "", ownerUserId: issue.ownerUserId,
    responseContent: issue.responseContent, escalated: issue.escalated, reportLineCodeIds: issue.reportLineCodeIds, remark: issue.remark,
  };
}

function ProgressEntryForm({ initial, options, members, onSubmit, onCancel, submitLabel, pending }: {
  initial: SnapshotInitial; options: Options; members: ProjectMemberOption[]; onSubmit: (payload: Record<string, unknown>) => void; onCancel?: () => void; submitLabel: string; pending: boolean;
}) {
  const [status, setStatus] = useState<IssueStatusValue>(initial.status);
  const [importance, setImportance] = useState<Probability>(initial.importance);
  const [priority, setPriority] = useState<Probability>(initial.priority);
  const [escalated, setEscalated] = useState(initial.escalated);
  const [reportLineCodeIds, setReportLineCodeIds] = useState<string[]>(initial.reportLineCodeIds);
  const [ownerIds, setOwnerIds] = useState<string[]>(initial.ownerUserId ? [initial.ownerUserId] : []);

  function toggleReportLine(codeId: string) {
    setReportLineCodeIds((prev) => (prev.includes(codeId) ? prev.filter((id) => id !== codeId) : [...prev, codeId]));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      entryDate: form.get("entryDate"), status, categoryCodeId: form.get("categoryCodeId"), title: form.get("title"), description: form.get("description"),
      importance, priority, dueAt: form.get("dueAt") || undefined, ownerUserId: ownerIds[0], responseContent: form.get("responseContent"),
      escalated, reportLineCodeIds: escalated ? reportLineCodeIds : [], remark: form.get("remark"),
    });
  }

  return <form onSubmit={submit}>
    <div className="form-grid">
      <label>일자<input type="date" name="entryDate" required defaultValue={initial.entryDate} /></label>
      <fieldset><legend>상태</legend><div className="chips">{issueStatuses.map((s) => <button type="button" key={s.value} className={status === s.value ? "selected" : ""} onClick={() => setStatus(s.value)}>{s.label}</button>)}</div></fieldset>
    </div>
    <div className="form-grid">
      <label>이슈구분<select name="categoryCodeId" defaultValue={initial.categoryCodeId}>{options.issueTypes.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select></label>
      <label>해결기한<input type="date" name="dueAt" defaultValue={initial.dueAt} /></label>
    </div>
    <label>이슈명<input name="title" required maxLength={200} defaultValue={initial.title} /></label>
    <label>이슈내용<textarea name="description" rows={3} maxLength={10000} defaultValue={initial.description} /></label>
    <div className="form-grid">
      <fieldset><legend>중요도</legend><div className="chips">{probabilities.map((item) => <button type="button" key={item.value} className={importance === item.value ? "selected" : ""} onClick={() => setImportance(item.value)}>{item.label}</button>)}</div></fieldset>
      <fieldset><legend>우선순위</legend><div className="chips">{probabilities.map((item) => <button type="button" key={item.value} className={priority === item.value ? "selected" : ""} onClick={() => setPriority(item.value)}>{item.label}</button>)}</div></fieldset>
    </div>
    <div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={ownerIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setOwnerIds(ids.slice(-1))} /></div></div>
    <label>대응전략/조치내용/결과<textarea name="responseContent" rows={3} maxLength={10000} defaultValue={initial.responseContent} /></label>
    <div className="form-grid">
      <fieldset><legend>에스컬레이션여부</legend><div className="chips">
        <button type="button" className={!escalated ? "selected" : ""} onClick={() => setEscalated(false)}>미수행</button>
        <button type="button" className={escalated ? "selected" : ""} onClick={() => setEscalated(true)}>수행</button>
      </div></fieldset>
      <fieldset><legend>보고라인 {escalated && <small>(복수 선택 가능)</small>}</legend><div className="chips">
        {options.reportLines.map((code) => <button type="button" key={code.id} disabled={!escalated} className={reportLineCodeIds.includes(code.id) ? "selected" : ""} onClick={() => toggleReportLine(code.id)}>{code.label}</button>)}
      </div></fieldset>
    </div>
    <label>비고<textarea name="remark" rows={2} maxLength={2000} defaultValue={initial.remark} /></label>
    <div className="alert-dialog-actions">
      {onCancel && <button className="button secondary" type="button" onClick={onCancel}>취소</button>}
      <button className="button primary" type="submit" disabled={pending}>{pending ? "저장 중…" : submitLabel}</button>
    </div>
  </form>;
}

export function IssueFormActions({ issue, options, members }: { issue: IssueRow; options: Options; members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown> | null, action: string) {
    setPending(action); setMessage("");
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify({ ...body, version: issue.version }) : undefined });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "요청을 처리하지 못했습니다."); setPending(""); return false;
    }
    setPending(""); router.refresh(); return true;
  }

  async function addEntry(payload: Record<string, unknown>) {
    if (await mutate(`/api/v1/issues/${issue.id}/progress`, "POST", payload, "add-entry")) setShowAddForm(false);
  }
  async function saveEntry(entryId: string, payload: Record<string, unknown>) {
    if (await mutate(`/api/v1/issues/${issue.id}/progress/${entryId}`, "PATCH", payload, `edit-${entryId}`)) setEditingEntryId(null);
  }
  async function deleteEntry(entryId: string) {
    await mutate(`/api/v1/issues/${issue.id}/progress/${entryId}`, "DELETE", null, `delete-${entryId}`);
  }

  return <>
    <section className="panel action-panel">
      <div className="panel-head"><h2>{issue.title}</h2><span>버전 {issue.version} · 현재 상태 {issueStatusLabel(issue.status)}</span></div>
      <p className="table-wrap-note">진행 이력을 추가하면 그 내용이 곧 이슈 정보가 됩니다 — 최초 등록과 동일한 항목을 갖춘 스냅샷이 이슈 현황에 즉시 반영됩니다.</p>
    </section>

    <section className="panel form-panel detail-edit">
      <div className="panel-head"><h2>진행 이력</h2><span>{issue.progressEntries.length}건</span></div>
      <div className="history-list">
        {issue.progressEntries.map((entry, index) => editingEntryId === entry.id ? (
          <div key={entry.id} className="history-item history-item-edit">
            <ProgressEntryForm initial={entryToInitial(entry)} options={options} members={members} submitLabel="저장" pending={pending === `edit-${entry.id}`} onCancel={() => setEditingEntryId(null)} onSubmit={(payload) => saveEntry(entry.id, payload)} />
          </div>
        ) : (
          <article className="history-item" key={entry.id}>
            <div><span className="mono">{issue.seq}.{index + 1}</span><span className={`badge status-${entry.status.toLowerCase()}`}>{issueStatusLabel(entry.status)}</span><time>{entry.entryDate.slice(0, 10)}</time></div>
            <dl className="issue-progress-summary">
              <div><dt>이슈구분</dt><dd>{entry.categoryLabel}</dd></div>
              <div><dt>중요도/우선순위</dt><dd>{entry.importance}/{entry.priority}</dd></div>
              <div><dt>담당자</dt><dd>{entry.ownerName ?? "-"}</dd></div>
              <div><dt>해결기한</dt><dd>{entry.dueAt ? entry.dueAt.slice(0, 10) : "-"}</dd></div>
            </dl>
            <p className="prewrap">{entry.responseContent || entry.description || "-"}</p>
            {entry.escalated && <p><span className="badge escalated">에스컬레이션</span> {entry.reportLineLabels.join(", ")}</p>}
            {entry.remark && <p className="prewrap"><small>비고: {entry.remark}</small></p>}
            <div className="history-item-footer"><small>{entry.actorName ?? "-"}</small><div className="history-item-actions">
              <button className="text-button" type="button" onClick={() => setEditingEntryId(entry.id)}>수정</button>
              <AlertDialog.Root>
                <AlertDialog.Trigger asChild><button className="text-button danger" type="button" disabled={issue.progressEntries.length <= 1}>삭제</button></AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Overlay className="calendar-modal-backdrop" />
                  <AlertDialog.Content className="alert-dialog">
                    <AlertDialog.Title asChild><h2>이 진행 이력을 삭제하시겠습니까?</h2></AlertDialog.Title>
                    <AlertDialog.Description asChild><p>삭제하면 이슈 정보는 남은 항목 중 가장 최근 것으로 다시 계산됩니다.</p></AlertDialog.Description>
                    <div className="alert-dialog-actions">
                      <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
                      <AlertDialog.Action asChild><button className="button danger" type="button" onClick={() => deleteEntry(entry.id)}>삭제</button></AlertDialog.Action>
                    </div>
                  </AlertDialog.Content>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            </div></div>
          </article>
        ))}
      </div>
      {showAddForm ? (
        <div className="history-item history-item-new">
          <ProgressEntryForm initial={issueToInitial(issue)} options={options} members={members} submitLabel="추가" pending={pending === "add-entry"} onCancel={() => setShowAddForm(false)} onSubmit={addEntry} />
        </div>
      ) : <button className="button primary" type="button" onClick={() => setShowAddForm(true)}>+ 진행 이력 추가</button>}
      {message && <p className="form-error action-message" role="alert">{message}</p>}
    </section>
  </>;
}
