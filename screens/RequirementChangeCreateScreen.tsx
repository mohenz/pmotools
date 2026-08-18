"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptanceLabels } from "@/lib/domain/requirements";
import type { RequirementRow } from "@/lib/server/requirements";

export function RequirementChangeCreateScreen({ requirement }: { requirement: RequirementRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const diff = (name: string, current: string) => { const value = String(data.get(name) ?? "").trim(); return value !== current.trim() ? value : null; };
    const proposedAcceptance = String(data.get("proposedAcceptance") ?? "") !== requirement.acceptanceStatus ? data.get("proposedAcceptance") : null;
    const body = {
      title: data.get("title"),
      changeReason: data.get("changeReason"),
      proposedTitle: diff("proposedTitle", requirement.title),
      proposedContent: diff("proposedContent", requirement.content),
      proposedBasis: diff("proposedBasis", requirement.basis),
      proposedPrecondition: diff("proposedPrecondition", requirement.precondition),
      proposedResolution: diff("proposedResolution", requirement.resolution),
      proposedAcceptance,
    };
    const response = await fetch(`/api/v1/requirements/${requirement.id}/changes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "제출하지 못했습니다."); return; }
    router.push(`/requirements/${requirement.id}`); router.refresh();
  }

  return <>
    <header className="topbar"><div><p className="mono requirement-id">{requirement.requirementId || "요구사항 ID 미입력"}</p><h1>변경요청 제출</h1></div><div className="topbar-actions"><Link className="button secondary" href={`/requirements/${requirement.id}`}>상세로</Link></div></header>
    <div className="content">
      <section className="panel form-panel"><div className="panel-head"><h2>{requirement.title}</h2><span>현재 버전 {requirement.version}</span></div>
        <form onSubmit={submit}>
          <label>변경요청명<input name="title" required maxLength={200} placeholder="예: 해결방안 재검토 요청" /></label>
          <label>변경사유<textarea name="changeReason" required rows={2} maxLength={2000} placeholder="왜 이 변경이 필요한지 기술" /></label>
          <details><summary>제안할 값 입력 (바꿀 항목만 실제 값과 다르게 입력)</summary>
            <label>요구사항명(제안)<input name="proposedTitle" maxLength={200} defaultValue={requirement.title} /></label>
            <label>요구사항내용(제안)<textarea name="proposedContent" rows={3} maxLength={10000} defaultValue={requirement.content} /></label>
            <label>요구사항출처(제안)<textarea name="proposedBasis" rows={2} maxLength={5000} defaultValue={requirement.basis} /></label>
            <label>사전확인사항(제안)<textarea name="proposedPrecondition" rows={2} maxLength={5000} defaultValue={requirement.precondition} /></label>
            <label>요구사항해결방안(제안)<textarea name="proposedResolution" rows={2} maxLength={5000} defaultValue={requirement.resolution} /></label>
            <label>요구사항수용여부(제안)<select name="proposedAcceptance" defaultValue={requirement.acceptanceStatus}>{Object.entries(acceptanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          </details>
          {message && <p className="form-error">{message}</p>}
          <button className="button primary" type="submit" disabled={saving}>{saving ? "제출 중…" : "변경요청 제출"}</button>
        </form>
      </section>
    </div>
  </>;
}
