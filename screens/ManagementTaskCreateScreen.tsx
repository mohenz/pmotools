"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BAND_LABEL, MANAGEMENT_TASK_AXES, MANAGEMENT_TASK_STATUSES, scoreBand, totalScore, type ManagementTaskPercents } from "@/lib/domain/management-tasks";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import { PersonPicker } from "@/components/PersonPicker";

const today = () => new Date().toISOString().slice(0, 10);

export function ManagementTaskCreateScreen({ groups, members }: { groups: CommonCode[]; members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [percents, setPercents] = useState<ManagementTaskPercents>({ prep: 0, owner: 0, progress: 0, issue: 0, close: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const score = useMemo(() => totalScore(percents), [percents]);
  const band = scoreBand(score);
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
        prepContent: form.get("prepContent"), prepPercent: percents.prep,
        ownerContent: form.get("ownerContent"), ownerPercent: percents.owner,
        progressContent: form.get("progressContent"), progressPercent: percents.progress,
        issueContent: form.get("issueContent"), issuePercent: percents.issue,
        closeContent: form.get("closeContent"), closePercent: percents.close,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message ?? "등록하지 못했습니다."); setSaving(false); return;
    }
    router.push(`/management-tasks/${payload.data.id}`); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>관리업무항목 등록</h1><p>업무모듈별 관리업무항목 신규 생성</p></div></header>
    <div className="content"><section className="panel form-panel"><form onSubmit={submit}>
      {!ready && <p className="form-error" role="alert">등록된 업무모듈(Track)이 없습니다. 설정에서 업무모듈을 먼저 등록해 주세요.</p>}
      <div className="form-grid">
        <label>업무모듈<select name="groupId" required>{groups.map((group) => <option value={group.id} key={group.id}>{group.label}</option>)}</select></label>
        <label>등록일자<input type="date" name="registrationDate" required defaultValue={today()} /></label>
      </div>
      <label>관리업무항목명<input name="name" required maxLength={200} placeholder="예: 결제 인터페이스 연동" /></label>
      <div className="form-grid">
        <div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={assigneeIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setAssigneeIds(ids)} /></div></div>
        <label>진행현황<select name="status" defaultValue="IDENTIFIED">{MANAGEMENT_TASK_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
      </div>
      <label>관리목적<textarea name="purpose" rows={2} maxLength={2000} /></label>
      <label>영향도분석<textarea name="impactAnalysis" rows={2} maxLength={2000} /></label>

      {MANAGEMENT_TASK_AXES.map((axis) => <fieldset key={axis.key}>
        <legend>{axis.label} <small>({percents[axis.key]}% · {Math.round(percents[axis.key] * 0.2)}점)</small></legend>
        <div className="form-grid management-axis-grid">
          <label>내용<textarea name={`${axis.key}Content`} rows={2} maxLength={2000} placeholder={`${axis.label} 내용`} /></label>
          <label>평가점수(%)<input type="number" min={0} max={100} value={percents[axis.key]} onChange={(e) => setPercents((prev) => ({ ...prev, [axis.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} /></label>
        </div>
      </fieldset>)}

      <div className="suggest"><span className={`badge band-${band}`}>{BAND_LABEL[band]} · 총점 {score}점</span><p>5개 축의 평가점수 합산 결과입니다.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="auth-hint">저장 후 선후행 관계를 등록할 수 있습니다.</p>
      <button className="button primary" type="submit" disabled={saving || !ready}>{saving ? "등록 중…" : "등록하기"}</button>
    </form></section></div>
  </>;
}
