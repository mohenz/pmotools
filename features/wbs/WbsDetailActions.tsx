"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { WBS_ITEM_STATUSES, isSameOrDescendantPath, sortKeyFromCode } from "@/lib/domain/wbs";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import type { WbsAssignmentRow, WbsDeliverableRow, WbsExcelRow, WbsItemRow } from "@/lib/server/wbs";

function parentLabel(item: WbsItemRow) {
  return `${"— ".repeat(item.level - 1)}${item.code} ${item.name}`;
}

function percent(value: number | null) {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

export function WbsDetailActions({ item, items, groups, members, assignments, deliverable, excelRow }: { item: WbsItemRow; items: WbsItemRow[]; groups: CommonCode[]; members: ProjectMemberOption[]; assignments: WbsAssignmentRow[]; deliverable: WbsDeliverableRow | null; excelRow: WbsExcelRow | null }) {
  const router = useRouter();
  const [version, setVersion] = useState(item.version);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  // 자기 자신과 자신의 하위 항목은 새 상위 항목으로 고를 수 없다(순환 방지).
  const parentOptions = items.filter((candidate) => candidate.id !== item.id && !isSameOrDescendantPath(item.path, candidate.path));

  async function mutate(path: string, method: "POST" | "PATCH" | "PUT", body: Record<string, unknown>, action: string) {
    setPending(action); setMessage("");
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, version }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "요청을 처리하지 못했습니다."); setPending(""); return false;
    }
    if (payload?.data?.version) setVersion(payload.data.version);
    setPending(""); return true;
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await mutate(`/api/v1/wbs-items/${item.id}`, "PATCH", {
      parentId: form.get("parentId") || null, name: form.get("name"), description: form.get("description"),
      ownerUserId: form.get("ownerUserId") || null, groupId: form.get("groupId") || null,
      startDate: form.get("startDate") || null, dueDate: form.get("dueDate") || null,
      actualStartDate: form.get("actualStartDate") || null, actualDueDate: form.get("actualDueDate") || null, status: form.get("status"),
      configStatus: form.get("configStatus"), weight: form.get("weight") ? Number(form.get("weight")) : null,
    }, "details");
    if (saved) { router.push(`/wbs/${item.id}`); router.refresh(); }
  }

  async function archive() {
    if (await mutate(`/api/v1/wbs-items/${item.id}/archive`, "POST", {}, "archive")) { router.push("/wbs"); router.refresh(); }
  }

  async function saveAssignments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rows = groups
      .filter((group) => form.get(`perm-${group.id}`) === "on")
      .map((group) => ({ groupId: group.id, progressPercent: Number(form.get(`pct-${group.id}`)) || 0 }));
    if (await mutate(`/api/v1/wbs-items/${item.id}/assignments`, "PUT", { assignments: rows }, "assignments")) router.refresh();
  }

  async function saveDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await mutate(`/api/v1/wbs-items/${item.id}/deliverable`, "PATCH", {
      note: form.get("note"), isOfficial: form.get("isOfficial") === "on",
      fileUrl: form.get("fileUrl"), templateUrl: form.get("templateUrl"),
      reviewerUserId: form.get("reviewerUserId") || null, reviewedAt: form.get("reviewedAt") || null,
    }, "deliverable")) router.refresh();
  }

  return <>
    <article className="panel compact detail-summary">
      <div className="panel-head"><h2>기본 정보</h2></div>
      <dl className="wbs-field-grid">
        <div><dt>wbs_level</dt><dd>{item.level}</dd></div>
        <div><dt>sort</dt><dd className="mono">{sortKeyFromCode(item.code)}</dd></div>
        <div><dt>Project No.</dt><dd>{excelRow?.projectCode || "-"}</dd></div>
        <div><dt>Task</dt><dd className="mono">{item.code}</dd></div>
        <div><dt>TRACK</dt><dd>-</dd></div>
        <div><dt>트랜젝션코드(정렬SEQ)</dt><dd className="mono">{excelRow?.sequenceNo ?? "-"}</dd></div>
        <div><dt>상세진도(진도관리대상-4레벨)</dt><dd>{excelRow?.isLeaf ? "대상" : "-"}</dd></div>
        <div><dt>Stage</dt><dd>{item.stage ?? "-"}</dd></div>
      </dl>
    </article>

    <article className="panel compact detail-summary">
      <div className="panel-head"><h2>계산값 · 진척 현황</h2></div>
      <dl className="wbs-field-grid">
        <div><dt>계산 가중치(입력불필요)</dt><dd>{item.workingDays ?? "-"}</dd></div>
        <div><dt>Sort(Working Day)</dt><dd>{item.workingDays ?? "-"}</dd></div>
        <div><dt>세부진도(입력불필요)</dt><dd>{Math.round(item.actualProgress * 100)}</dd></div>
        <div><dt>목표(today)</dt><dd>{percent(item.plannedProgress)}</dd></div>
        <div><dt>실적</dt><dd>{percent(item.actualProgress)}</dd></div>
        <div><dt>진척율</dt><dd>{percent(item.progressIndex)}</dd></div>
      </dl>
    </article>

    <section className="panel compact form-panel detail-edit"><div className="panel-head"><h2>기본 정보 수정</h2><span>버전 {version}</span></div><form onSubmit={saveDetails}>
      <div className="wbs-inline-form">
        <label>상위 항목<select name="parentId" defaultValue={item.parentId ?? ""}><option value="">(최상위 레벨)</option>{parentOptions.map((option) => <option value={option.id} key={option.id}>{parentLabel(option)}</option>)}</select></label>
        <label>상태<select name="status" defaultValue={item.status}>{WBS_ITEM_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
        <label>Track<select name="groupId" defaultValue={item.groupId ?? ""}><option value="">미지정</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
        <label>담당자<select name="ownerUserId" defaultValue={item.ownerUserId ?? ""}><option value="">미지정</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.userId})</option>)}</select></label>
        <label>계획시작일<input type="date" name="startDate" defaultValue={item.startDate ?? ""} /></label>
        <label>계획종료일<input type="date" name="dueDate" defaultValue={item.dueDate ?? ""} /></label>
        <label>실적시작일<input type="date" name="actualStartDate" defaultValue={item.actualStartDate ?? ""} /></label>
        <label>실적종료일<input type="date" name="actualDueDate" defaultValue={item.actualDueDate ?? ""} /></label>
        <label>설정상태<input name="configStatus" maxLength={200} defaultValue={item.configStatus} /></label>
        <label>가중치<input type="number" name="weight" min={0} max={999999.99} step="0.01" defaultValue={item.weight ?? ""} placeholder="비워두면 영업일수로 자동 산정" /></label>
        <label>항목명<input name="name" required maxLength={200} defaultValue={item.name} /></label>
        <button className="button primary" type="submit" disabled={!!pending}>{pending === "details" ? "저장 중…" : "수정 저장"}</button>
      </div>
      <label>내용<textarea name="description" rows={3} maxLength={10000} defaultValue={item.description} /></label>
    </form></section>

    <section className="panel compact form-panel detail-edit"><div className="panel-head"><h2>역할별 진척등록권한·진도율</h2><span>{assignments.filter((a) => a.hasPermission).length}/{assignments.length}개 Track</span></div>
      {groups.length ? <form onSubmit={saveAssignments}>
        <div className="wbs-inline-form">
          {assignments.map((a) => <label key={a.groupId}>{a.groupLabel}
            <span className="wbs-track-controls">
              <input type="checkbox" name={`perm-${a.groupId}`} defaultChecked={a.hasPermission} title="등록권한" />
              <input type="number" name={`pct-${a.groupId}`} min={0} max={100} defaultValue={a.progressPercent} />%
            </span>
          </label>)}
          <button className="button primary" type="submit" disabled={!!pending}>{pending === "assignments" ? "저장 중…" : "역할별 진도 저장"}</button>
        </div>
      </form> : <p className="attendee-empty">등록된 Track이 없습니다.</p>}
    </section>

    <section className="panel compact form-panel detail-edit"><div className="panel-head"><h2>산출물 검수</h2></div><form onSubmit={saveDeliverable}>
      <div className="wbs-inline-form">
        <label>산출물템플릿<input name="templateUrl" maxLength={1000} defaultValue={deliverable?.templateUrl ?? ""} placeholder="템플릿 URL 또는 경로" /></label>
        <label>파일위치<input name="fileUrl" maxLength={1000} defaultValue={deliverable?.fileUrl ?? ""} placeholder="산출물 파일 URL 또는 경로" /></label>
        <label>검수자<select name="reviewerUserId" defaultValue={deliverable?.reviewerUserId ?? ""}><option value="">미지정</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.userId})</option>)}</select></label>
        <label>검수실행일<input type="date" name="reviewedAt" defaultValue={deliverable?.reviewedAt ?? ""} /></label>
      </div>
      <label className="toggle"><input type="checkbox" name="isOfficial" defaultChecked={deliverable?.isOfficial ?? false} /> 공식 산출물로 확정</label>
      <label>이슈 및 사유<textarea name="note" rows={3} maxLength={5000} defaultValue={deliverable?.note ?? ""} /></label>
      <button className="button primary" type="submit" disabled={!!pending}>{pending === "deliverable" ? "저장 중…" : "산출물 정보 저장"}</button>
    </form></section>

    {message && <p className="form-error action-message" role="alert">{message}</p>}
    <section className="danger-zone"><div><strong>항목 보관</strong><p>보관하면 하위 항목을 포함해 목록·조회에서 제외됩니다.</p></div>
      <AlertDialog.Root>
        <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={!!pending}>{pending === "archive" ? "처리 중…" : "보관 처리"}</button></AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="calendar-modal-backdrop" />
          <AlertDialog.Content className="alert-dialog">
            <AlertDialog.Title asChild><h2>이 항목을 보관 처리하시겠습니까?</h2></AlertDialog.Title>
            <AlertDialog.Description asChild><p>하위 항목을 포함해 목록·조회에서 제외됩니다.</p></AlertDialog.Description>
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
