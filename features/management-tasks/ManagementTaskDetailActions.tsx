"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { BAND_LABEL, MANAGEMENT_TASK_AXES, MANAGEMENT_TASK_STATUSES, scoreBand, totalScore, type ManagementTaskPercents } from "@/lib/domain/management-tasks";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ManagementTaskLinkSummary, ManagementTaskRow } from "@/lib/server/management-tasks";
import { TaskLinkPicker } from "@/features/management-tasks/TaskLinkPicker";
import type { ProjectMemberOption } from "@/lib/server/users";
import { PersonPicker } from "@/components/PersonPicker";

export function ManagementTaskDetailActions({ task, predecessors, successors, groups, members }: { task: ManagementTaskRow; predecessors: ManagementTaskLinkSummary[]; successors: ManagementTaskLinkSummary[]; groups: CommonCode[]; members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [version, setVersion] = useState(task.version);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const [percents, setPercents] = useState<ManagementTaskPercents>({ prep: task.prepPercent, owner: task.ownerPercent, progress: task.progressPercent, issue: task.issuePercent, close: task.closePercent });
  const [assigneeIds, setAssigneeIds] = useState(task.assignees.map((assignee) => assignee.id));
  const score = useMemo(() => totalScore(percents), [percents]);
  const band = scoreBand(score);

  async function mutate(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, action: string) {
    setPending(action); setMessage("");
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, version }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "요청을 처리하지 못했습니다."); setPending(""); return false;
    }
    if (payload?.data?.version) setVersion(payload.data.version);
    setPending(""); router.refresh(); return true;
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(`/api/v1/management-tasks/${task.id}`, "PATCH", {
      groupId: form.get("groupId"), name: form.get("name"), registrationDate: form.get("registrationDate"),
      assigneeIds, status: form.get("status"), purpose: form.get("purpose"), impactAnalysis: form.get("impactAnalysis"),
      prepContent: form.get("prepContent"), prepPercent: percents.prep,
      ownerContent: form.get("ownerContent"), ownerPercent: percents.owner,
      progressContent: form.get("progressContent"), progressPercent: percents.progress,
      issueContent: form.get("issueContent"), issuePercent: percents.issue,
      closeContent: form.get("closeContent"), closePercent: percents.close,
    }, "details");
  }

  async function archive() {
    if (await mutate(`/api/v1/management-tasks/${task.id}/archive`, "POST", {}, "archive")) router.push("/management-tasks");
  }

  async function link(relation: "predecessor" | "successor", targetId: string) {
    await mutate(`/api/v1/management-tasks/${task.id}/links`, "POST", { targetId, relation }, `link-${relation}`);
  }

  async function unlink(linkId: string) {
    await mutate(`/api/v1/management-tasks/${task.id}/links`, "DELETE", { linkId }, `unlink-${linkId}`);
  }

  return <>
    <section className="panel form-panel detail-edit"><div className="panel-head"><h2>기본 정보 수정</h2><span>버전 {version}</span></div><form onSubmit={saveDetails}>
      <div className="form-grid">
        <label>업무모듈<select name="groupId" defaultValue={task.groupId}>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
        <label>등록일자<input type="date" name="registrationDate" required defaultValue={task.registrationDate} /></label>
      </div>
      <label>관리업무항목명<input name="name" required maxLength={200} defaultValue={task.name} /></label>
      <div className="form-grid">
        <div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={assigneeIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setAssigneeIds(ids)} /></div></div>
        <label>진행현황<select name="status" defaultValue={task.status}>{MANAGEMENT_TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      </div>
      <label>관리목적<textarea name="purpose" rows={2} maxLength={2000} defaultValue={task.purpose} /></label>
      <label>영향도분석<textarea name="impactAnalysis" rows={2} maxLength={2000} defaultValue={task.impactAnalysis} /></label>

      {MANAGEMENT_TASK_AXES.map((axis) => {
        const contentField = `${axis.key}Content` as const;
        return <fieldset key={axis.key}>
          <legend>{axis.label} <small>({percents[axis.key]}% · {Math.round(percents[axis.key] * 0.2)}점)</small></legend>
          <div className="form-grid management-axis-grid">
            <label>내용<textarea name={contentField} rows={2} maxLength={2000} defaultValue={task[contentField]} /></label>
            <label>평가점수(%)<input type="number" min={0} max={100} value={percents[axis.key]} onChange={(e) => setPercents((prev) => ({ ...prev, [axis.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} /></label>
          </div>
        </fieldset>;
      })}
      <div className="suggest"><span className={`badge band-${band}`}>{BAND_LABEL[band]} · 총점 {score}점</span><p>저장 시 이 값으로 갱신됩니다.</p></div>
      <button className="button primary" type="submit" disabled={!!pending}>{pending === "details" ? "저장 중…" : "수정 저장"}</button>
    </form></section>

    <section className="panel">
      <div className="panel-head"><h2>선후행 관계</h2><span>선행 {predecessors.length}건 · 후행 {successors.length}건</span></div>
      <div className="form-grid">
        <div>
          <p className="field-label">선행 항목</p>
          <TaskLinkPicker excludeId={task.id} relation="predecessor" onPick={(picked) => link("predecessor", picked.id)} />
          {predecessors.length > 0 ? <ul className="attendee-chips">{predecessors.map((item) => <li key={item.linkId}>{item.displayId} <small>({item.name})</small><button type="button" aria-label={`${item.name} 선행 해제`} disabled={!!pending} onClick={() => unlink(item.linkId)}>×</button></li>)}</ul> : <p className="attendee-empty">등록된 선행 항목이 없습니다.</p>}
        </div>
        <div>
          <p className="field-label">후행 항목</p>
          <TaskLinkPicker excludeId={task.id} relation="successor" onPick={(picked) => link("successor", picked.id)} />
          {successors.length > 0 ? <ul className="attendee-chips">{successors.map((item) => <li key={item.linkId}>{item.displayId} <small>({item.name})</small><button type="button" aria-label={`${item.name} 후행 해제`} disabled={!!pending} onClick={() => unlink(item.linkId)}>×</button></li>)}</ul> : <p className="attendee-empty">등록된 후행 항목이 없습니다.</p>}
        </div>
      </div>
    </section>

    {message && <p className="form-error action-message" role="alert">{message}</p>}
    <section className="danger-zone"><div><strong>항목 보관</strong><p>보관된 항목은 목록·대시보드·선후행 검색에서 제외됩니다.</p></div>
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={!!pending}>{pending === "archive" ? "처리 중…" : "보관 처리"}</button></AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="calendar-modal-backdrop" />
          <AlertDialog.Content className="alert-dialog">
            <AlertDialog.Title asChild><h2>이 항목을 보관 처리하시겠습니까?</h2></AlertDialog.Title>
            <AlertDialog.Description asChild><p>보관하면 목록·대시보드·선후행 검색에서 제외됩니다.</p></AlertDialog.Description>
            <div className="alert-dialog-actions">
              <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button className="button danger" type="button" onClick={archive}>보관 처리</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  </>;
}
