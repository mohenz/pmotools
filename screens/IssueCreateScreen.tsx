"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { probabilities, type Probability } from "@/lib/domain/levels";
import type { CommonCode } from "@/lib/server/common-codes";
import type { ProjectMemberOption } from "@/lib/server/users";
import { PersonPicker } from "@/components/PersonPicker";

const today = () => new Date().toISOString().slice(0, 10);

type Options = { issueTypes: CommonCode[]; reportLines: CommonCode[] };

export function IssueCreateScreen({ options, members }: { options: Options; members: ProjectMemberOption[] }) {
  const router = useRouter();
  const [importance, setImportance] = useState<Probability>("high");
  const [priority, setPriority] = useState<Probability>("high");
  const [escalated, setEscalated] = useState(false);
  const [reportLineCodeIds, setReportLineCodeIds] = useState<string[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ready = options.issueTypes.length > 0;

  function toggleReportLine(codeId: string) {
    setReportLineCodeIds((prev) => (prev.includes(codeId) ? prev.filter((id) => id !== codeId) : [...prev, codeId]));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/issues", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        categoryCodeId: form.get("categoryCodeId"), title: form.get("title"), description: form.get("description"),
        importance, priority, occurredAt: form.get("occurredAt"), dueAt: form.get("dueAt") || undefined,
        ownerUserId: ownerIds[0], responseContent: form.get("responseContent"),
        escalated, reportLineCodeIds: escalated ? reportLineCodeIds : [], remark: form.get("remark"),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error?.message ?? "등록하지 못했습니다."); setSaving(false); return;
    }
    router.push(`/issues/${payload.data.id}`); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>이슈 등록</h1><p>신규 이슈 생성</p></div></header>
    <div className="content"><section className="panel form-panel"><form onSubmit={submit}>
      {!ready && <p className="form-error" role="alert">활성 이슈구분 공통코드가 없습니다. 설정에서 먼저 등록해 주세요.</p>}
      <div className="form-grid">
        <label>이슈구분<select name="categoryCodeId" required>{options.issueTypes.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select></label>
        <label>발생일자<input type="date" name="occurredAt" required defaultValue={today()} /></label>
      </div>
      <label>이슈명<input name="title" required maxLength={200} placeholder="예: 결제 PG 연동 응답 지연" /></label>
      <label>이슈내용<textarea name="description" rows={4} maxLength={10000} placeholder="현황, 원인, 파급 범위를 구체적으로 기술" /></label>
      <div className="form-grid">
        <fieldset><legend>중요도</legend><div className="chips">{probabilities.map((item) => <button type="button" className={importance === item.value ? "selected" : ""} onClick={() => setImportance(item.value)} key={item.value}>{item.label}</button>)}</div></fieldset>
        <fieldset><legend>우선순위</legend><div className="chips">{probabilities.map((item) => <button type="button" className={priority === item.value ? "selected" : ""} onClick={() => setPriority(item.value)} key={item.value}>{item.label}</button>)}</div></fieldset>
      </div>
      <div className="form-grid">
        <label>해결기한<input type="date" name="dueAt" /></label>
        <div><span className="field-label">담당자</span><div className="attendee-picker"><PersonPicker people={members} selectedIds={ownerIds} selectedNames={[]} allowGuests={false} onChange={(ids) => setOwnerIds(ids.slice(-1))} /></div></div>
      </div>
      <label>대응전략/조치내용/결과<textarea name="responseContent" rows={3} maxLength={10000} /></label>
      <div className="form-grid">
        <fieldset><legend>에스컬레이션여부</legend><div className="chips">
          <button type="button" className={!escalated ? "selected" : ""} onClick={() => setEscalated(false)}>미수행</button>
          <button type="button" className={escalated ? "selected" : ""} onClick={() => setEscalated(true)}>수행</button>
        </div></fieldset>
        <fieldset><legend>보고라인 {escalated && <small>(복수 선택 가능)</small>}</legend><div className="chips">
          {options.reportLines.map((code) => <button type="button" key={code.id} disabled={!escalated} className={reportLineCodeIds.includes(code.id) ? "selected" : ""} onClick={() => toggleReportLine(code.id)}>{code.label}</button>)}
        </div></fieldset>
      </div>
      <label>비고<textarea name="remark" rows={2} maxLength={2000} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={saving || !ready}>{saving ? "등록 중…" : "등록하기"}</button>
    </form></section></div>
  </>;
}
