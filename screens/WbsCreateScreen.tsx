"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WBS_ITEM_STATUSES } from "@/lib/domain/wbs";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import type { WbsItemRow } from "@/lib/server/wbs";

function parentLabel(item: WbsItemRow) {
  return `${"— ".repeat(item.level - 1)}${item.code} ${item.name}`;
}

export function WbsCreateScreen({ items, groups, members }: { items: WbsItemRow[]; groups: CommonCode[]; members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/wbs-items", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentId: form.get("parentId") || null, name: form.get("name"), description: form.get("description"),
        ownerUserId: form.get("ownerUserId") || null, groupId: form.get("groupId") || null,
        startDate: form.get("startDate") || null, dueDate: form.get("dueDate") || null,
        actualStartDate: form.get("actualStartDate") || null, actualDueDate: form.get("actualDueDate") || null, status: form.get("status"),
        configStatus: form.get("configStatus"), weight: form.get("weight") ? Number(form.get("weight")) : null,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message ?? "등록하지 못했습니다."); setSaving(false); return;
    }
    const created = payload.data as { id: string; version: number };
    const id = created.id;
    let version = created.version;

    const assignments = groups
      .filter((group) => form.get(`perm-${group.id}`) === "on")
      .map((group) => ({ groupId: group.id, progressPercent: Number(form.get(`pct-${group.id}`)) || 0 }));
    if (assignments.length) {
      const assignmentsResponse = await fetch(`/api/v1/wbs-items/${id}/assignments`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, assignments }),
      });
      const assignmentsPayload = await assignmentsResponse.json().catch(() => null);
      if (assignmentsResponse.ok) version = assignmentsPayload.data.version;
    }

    const templateUrl = String(form.get("templateUrl") ?? ""), fileUrl = String(form.get("fileUrl") ?? "");
    const reviewerUserId = form.get("reviewerUserId") || null, reviewedAt = form.get("reviewedAt") || null;
    const note = String(form.get("note") ?? ""), isOfficial = form.get("isOfficial") === "on";
    if (templateUrl || fileUrl || reviewerUserId || reviewedAt || note || isOfficial) {
      await fetch(`/api/v1/wbs-items/${id}/deliverable`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, templateUrl, fileUrl, reviewerUserId, reviewedAt, note, isOfficial }),
      });
    }

    router.push(`/wbs/${id}`); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>WBS 항목 등록</h1><p>작업분류체계 신규 항목 생성</p></div></header>
    <div className="content"><form onSubmit={submit}>
      <section className="panel form-panel">
        <div className="wbs-inline-form">
          <label>상위 항목<select name="parentId" defaultValue=""><option value="">(최상위 레벨)</option>{items.map((item) => <option value={item.id} key={item.id}>{parentLabel(item)}</option>)}</select></label>
          <label>상태<select name="status" defaultValue="not_started">{WBS_ITEM_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label>Track<select name="groupId" defaultValue=""><option value="">미지정</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
          <label>담당자<select name="ownerUserId" defaultValue=""><option value="">미지정</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.userId})</option>)}</select></label>
          <label>계획시작일<input type="date" name="startDate" /></label>
          <label>계획종료일<input type="date" name="dueDate" /></label>
          <label>실적시작일<input type="date" name="actualStartDate" /></label>
          <label>실적종료일<input type="date" name="actualDueDate" /></label>
          <label>설정상태<input name="configStatus" maxLength={200} placeholder="형상관리 상태 등 자유 입력" /></label>
          <label>가중치<input type="number" name="weight" min={0} max={999999.99} step="0.01" placeholder="비워두면 영업일수로 자동 산정" /></label>
          <label>항목명<input name="name" required maxLength={200} placeholder="예: 계정신청 정보확인" /></label>
        </div>
        <label>내용<textarea name="description" rows={3} maxLength={10000} /></label>
      </section>

      <section className="panel compact form-panel">
        <div className="panel-head"><h2>역할별 진척등록권한·진도율</h2></div>
        {groups.length ? <div className="wbs-inline-form">
          {groups.map((group) => <label key={group.id}>{group.label}
            <span className="wbs-track-controls">
              <input type="checkbox" name={`perm-${group.id}`} title="등록권한" />
              <input type="number" name={`pct-${group.id}`} min={0} max={100} defaultValue={0} />%
            </span>
          </label>)}
        </div> : <p className="attendee-empty">등록된 Track이 없습니다.</p>}
      </section>

      <section className="panel compact form-panel">
        <div className="panel-head"><h2>산출물 검수</h2></div>
        <div className="wbs-inline-form">
          <label>산출물템플릿<input name="templateUrl" maxLength={1000} placeholder="템플릿 URL 또는 경로" /></label>
          <label>파일위치<input name="fileUrl" maxLength={1000} placeholder="산출물 파일 URL 또는 경로" /></label>
          <label>검수자<select name="reviewerUserId" defaultValue=""><option value="">미지정</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.userId})</option>)}</select></label>
          <label>검수실행일<input type="date" name="reviewedAt" /></label>
        </div>
        <label className="toggle"><input type="checkbox" name="isOfficial" /> 공식 산출물로 확정</label>
        <label>이슈 및 사유<textarea name="note" rows={3} maxLength={5000} /></label>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={saving}>{saving ? "등록 중…" : "등록하기"}</button>
    </form></div>
  </>;
}
