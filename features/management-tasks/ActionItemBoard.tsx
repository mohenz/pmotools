"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ACTION_ITEM_STATUSES } from "@/lib/domain/action-items";
import { BAND_LABEL } from "@/lib/domain/management-tasks";
import type { ActionItemRow, ManagementTaskAxisActionItems } from "@/lib/server/action-items";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";

const PRIORITY_OPTIONS = [{ value: "HIGH", label: "상" }, { value: "MEDIUM", label: "중" }, { value: "LOW", label: "하" }];

type BoardProps = { taskId: string; axes: ManagementTaskAxisActionItems[]; groups: CommonCode[]; members: ProjectMemberOption[]; categories: CommonCode[] };

export function ActionItemBoard({ taskId, axes, groups, members, categories }: BoardProps) {
  return <section className="panel">
    <div className="panel-head"><h2>세부항목별 액션아이템</h2></div>
    {axes.map((axis) => <AxisPanel key={axis.axisKey} taskId={taskId} axis={axis} groups={groups} members={members} categories={categories} />)}
  </section>;
}

function AxisPanel({ taskId, axis, groups, members, categories }: { taskId: string; axis: ManagementTaskAxisActionItems } & Pick<BoardProps, "groups" | "members" | "categories">) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const body = fieldsFromForm(form);
    const response = await fetch(`/api/v1/management-tasks/${taskId}/action-items`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, detailItemId: axis.detailItemId }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "등록하지 못했습니다."); return; }
    setAdding(false); router.refresh();
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, item: ActionItemRow) {
    event.preventDefault();
    setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const body = fieldsFromForm(form);
    const response = await fetch(`/api/v1/management-tasks/${taskId}/action-items/${item.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, version: item.version }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "수정하지 못했습니다."); return; }
    setEditingId(null); router.refresh();
  }

  async function archive(item: ActionItemRow) {
    setPending(true); setMessage("");
    const response = await fetch(`/api/v1/management-tasks/${taskId}/action-items/${item.id}`, {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: item.version }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "보관하지 못했습니다."); return; }
    router.refresh();
  }

  return <article className="panel-section action-item-axis">
    <div className="panel-head">
      <h3>{axis.label} <span className={`badge band-${axis.band}`}>{BAND_LABEL[axis.band]}</span></h3>
      <button type="button" className="button secondary" disabled={pending} onClick={() => { setAdding((v) => !v); setEditingId(null); }}>{adding ? "취소" : "액션아이템 추가"}</button>
    </div>
    {axis.actionItems.length === 0 && !adding ? <p className="attendee-empty">등록된 액션아이템이 없습니다.</p> : (
      <div className="table-wrap"><table className="action-item-table"><thead><tr>
        <th>번호</th><th>구분</th><th>액션아이템명</th><th>우선순위</th><th>중요도</th><th>업무그룹</th><th>담당자</th><th>기한</th><th>상태</th><th>WBS ID</th><th>비고</th><th></th>
      </tr></thead><tbody>
        {axis.actionItems.map((item) => editingId === item.id
          ? <tr key={item.id}><td colSpan={12}><form onSubmit={(e) => submitUpdate(e, item)}><ActionItemFields defaults={item} groups={groups} members={members} categories={categories} />
              <div className="form-actions"><button type="submit" className="button primary" disabled={pending}>저장</button><button type="button" className="button secondary" onClick={() => setEditingId(null)}>취소</button></div>
            </form></td></tr>
          : <tr key={item.id}>
              <td>{item.sequenceNo}</td><td>{item.categoryLabel ?? "-"}</td><td>{item.name}</td>
              <td>{PRIORITY_OPTIONS.find((p) => p.value === item.priority)?.label}</td><td>{PRIORITY_OPTIONS.find((p) => p.value === item.importance)?.label}</td>
              <td>{item.groupLabel}</td><td>{item.assigneeName}</td><td>{item.dueDate ?? "-"}</td>
              <td>{ACTION_ITEM_STATUSES.find((s) => s.value === item.status)?.label}</td><td>{item.wbsItemDisplayId ?? "-"}</td><td className="prewrap">{item.note || "-"}</td>
              <td><button type="button" className="button secondary" disabled={pending} onClick={() => { setEditingId(item.id); setAdding(false); }}>수정</button> <AlertDialog.Root>
                <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={pending}>보관</button></AlertDialog.Trigger>
                <AlertDialog.Portal>
                  <AlertDialog.Overlay className="calendar-modal-backdrop" />
                  <AlertDialog.Content className="alert-dialog">
                    <AlertDialog.Title asChild><h2>&quot;{item.name}&quot; 액션아이템을 보관 처리하시겠습니까?</h2></AlertDialog.Title>
                    <AlertDialog.Description asChild><p>보관하면 목록·세부항목 밴드 계산에서 제외됩니다.</p></AlertDialog.Description>
                    <div className="alert-dialog-actions">
                      <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
                      <AlertDialog.Action asChild><button className="button danger" type="button" onClick={() => archive(item)}>보관 처리</button></AlertDialog.Action>
                    </div>
                  </AlertDialog.Content>
                </AlertDialog.Portal>
              </AlertDialog.Root></td>
            </tr>)}
      </tbody></table></div>
    )}
    {adding && <form onSubmit={submitCreate} className="action-item-add-form"><ActionItemFields groups={groups} members={members} categories={categories} />
      <div className="form-actions"><button type="submit" className="button primary" disabled={pending}>{pending ? "등록 중…" : "등록"}</button></div>
    </form>}
    {message && <p className="form-error action-message" role="alert">{message}</p>}
  </article>;
}

function fieldsFromForm(form: FormData) {
  return {
    categoryCodeId: form.get("categoryCodeId") || null,
    name: form.get("name"),
    priority: form.get("priority"),
    importance: form.get("importance"),
    groupId: form.get("groupId"),
    assigneeId: form.get("assigneeId"),
    dueDate: form.get("dueDate") || null,
    status: form.get("status"),
    wbsDisplayId: form.get("wbsDisplayId") || "",
    note: form.get("note") || "",
  };
}

function ActionItemFields({ defaults, groups, members, categories }: { defaults?: ActionItemRow } & Pick<BoardProps, "groups" | "members" | "categories">) {
  return <div className="form-grid action-item-fields">
    <label>구분<select name="categoryCodeId" defaultValue={defaults?.categoryCodeId ?? ""}><option value="">미지정</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.label}</option>)}</select></label>
    <label>액션아이템명<input name="name" required maxLength={200} defaultValue={defaults?.name ?? ""} /></label>
    <label>우선순위<select name="priority" defaultValue={defaults?.priority ?? "MEDIUM"}>{PRIORITY_OPTIONS.map((p) => <option value={p.value} key={p.value}>{p.label}</option>)}</select></label>
    <label>중요도<select name="importance" defaultValue={defaults?.importance ?? "MEDIUM"}>{PRIORITY_OPTIONS.map((p) => <option value={p.value} key={p.value}>{p.label}</option>)}</select></label>
    <label>업무그룹<select name="groupId" required defaultValue={defaults?.groupId ?? ""}><option value="" disabled>선택</option>{groups.map((g) => <option value={g.id} key={g.id}>{g.label}</option>)}</select></label>
    <label>담당자<select name="assigneeId" required defaultValue={defaults?.assigneeId ?? ""}><option value="" disabled>선택</option>{members.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
    <label>기한<input type="date" name="dueDate" defaultValue={defaults?.dueDate ?? ""} /></label>
    <label>상태<select name="status" defaultValue={defaults?.status ?? "IDENTIFIED"}>{ACTION_ITEM_STATUSES.map((s) => <option value={s.value} key={s.value}>{s.label}</option>)}</select></label>
    <label>WBS ID<input name="wbsDisplayId" maxLength={100} placeholder="예: WBS-2026-000123" defaultValue={defaults?.wbsItemDisplayId ?? ""} /></label>
    <label className="span-2">비고<textarea name="note" rows={2} maxLength={2000} defaultValue={defaults?.note ?? ""} /></label>
  </div>;
}
