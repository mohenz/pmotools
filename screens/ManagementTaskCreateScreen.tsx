"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MANAGEMENT_TASK_STATUSES } from "@/lib/domain/management-tasks";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import { PersonPicker } from "@/components/PersonPicker";

const today = () => new Date().toISOString().slice(0, 10);

export function ManagementTaskCreateScreen({ groups, members }: { groups: CommonCode[]; members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const ready = groups.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/management-tasks", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        groupId: form.get("groupId"), name: form.get("name"), registrationDate: form.get("registrationDate"),
        assigneeIds, status: form.get("status"), purpose: form.get("purpose"), impactAnalysis: form.get("impactAnalysis"),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message ?? "등록하지 못했습니다."); setSaving(false); return;
    }
    router.push(`/management-tasks/${payload.data.id}`); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>관리업무항목 등록</h1><p>업무그룹별 관리업무항목 신규 생성</p></div></header>
    <div className="content"><section className="panel form-panel"><form onSubmit={submit}>
      {!ready && <p className="form-error" role="alert">등록된 업무그룹(Track)이 없습니다. 설정에서 업무그룹을 먼저 등록해 주세요.</p>}
      <div className="form-grid">
        <label>업무그룹<select name="groupId" required>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
        <label>등록일자<input type="date" name="registrationDate" required defaultValue={today()} /></label>
      </div>
      <label>관리업무항목명<input name="name" required maxLength={200} placeholder="예: 결제 인터페이스 연동" /></label>
      <div className="form-grid">
        <div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={assigneeIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setAssigneeIds(ids)} /></div></div>
        <label>진행현황<select name="status" defaultValue="IDENTIFIED">{MANAGEMENT_TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      </div>
      <label>관리목적<textarea name="purpose" rows={2} maxLength={2000} /></label>
      <label>영향도분석<textarea name="impactAnalysis" rows={2} maxLength={2000} /></label>

      <p className="auth-hint">저장 후 상세 화면에서 세부항목(일정/범위/자원/소통/품질)별 액션아이템을 등록할 수 있습니다. 신호등은 등록된 액션아이템 상태로 자동 산출됩니다.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={saving || !ready}>{saving ? "등록 중…" : "등록하기"}</button>
    </form></section></div>
  </>;
}
