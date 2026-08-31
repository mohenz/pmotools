"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WORK_LOG_STATUSES } from "@/lib/domain/work-logs";
import type { CommonCode } from "@/lib/server/common-codes";
import type { WorkLogDetail } from "@/lib/server/work-logs";
import type { WbsOwnerTaskOption } from "@/lib/server/wbs";
import { WbsTaskPicker } from "@/components/WbsTaskPicker";

function todayInKorea() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export function WorkLogFormScreen({ mode, groups, assigneeName, detail, wbsOptions = [] }: { mode: "create" | "edit"; groups: CommonCode[]; assigneeName: string; detail?: WorkLogDetail; wbsOptions?: WbsOwnerTaskOption[] }) {
  const router = useRouter(), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    const body = { workDate: form.get("workDate"), groupId: form.get("groupId"), wbsNumber: form.get("wbsNumber"), status: form.get("status"), workContent: form.get("workContent"), referenceContent: form.get("referenceContent"), notes: form.get("notes"), ...(detail ? { version: detail.version } : {}) };
    const response = await fetch(detail ? `/api/v1/work-logs/${detail.id}` : "/api/v1/work-logs", { method: detail ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setError(payload?.error?.message ?? "업무일지를 저장하지 못했습니다."); setSaving(false); return; }
    router.push(`/work-logs/${payload.data.id}`); router.refresh();
  }
  return <><header className="topbar"><div>{detail && <p className="mono">{detail.displayId}</p>}<h1>업무일지 {mode === "create" ? "작성" : "수정"}</h1><p>일별 작업자의 업무내용과 참고사항을 기록합니다.</p></div><div className="topbar-actions">{detail && <Link className="button secondary" href={`/work-logs/${detail.id}`}>조회 화면으로</Link>}<Link className="button secondary" href="/work-logs">목록으로</Link></div></header><div className="content"><section className="panel form-panel"><form onSubmit={submit}>
    {!groups.length && <p className="form-error">활성 업무그룹이 없습니다. 설정에서 업무그룹을 먼저 등록해 주세요.</p>}
    <div className="form-grid triple"><label>업무일자<input type="date" name="workDate" defaultValue={detail?.workDate ?? todayInKorea()} required /></label>{mode === "create" ? <label>업무그룹<input value={groups[0]?.label ?? "미지정"} readOnly aria-label="업무그룹" /><input type="hidden" name="groupId" value={groups[0]?.id ?? ""} /></label> : <label>업무그룹<select name="groupId" defaultValue={detail?.groupId} required>{groups.map((g) => <option value={g.id} key={g.id}>{g.label}</option>)}</select></label>}<label>담당자<input value={assigneeName} readOnly aria-label="담당자" /></label></div>
    <div className="form-grid"><label>WBS번호<WbsTaskPicker options={wbsOptions} defaultValue={detail?.wbsNumber} /></label><label>진행상태<select name="status" defaultValue={detail?.status ?? "IN_PROGRESS"}>{WORK_LOG_STATUSES.map((s) => <option value={s.value} key={s.value}>{s.label}</option>)}</select></label></div>
    <label>업무내용<textarea name="workContent" rows={6} defaultValue={detail?.workContent} maxLength={5000} required placeholder="수행한 업무내용을 입력하세요." /></label>
    <label>참고내용<textarea name="referenceContent" rows={4} defaultValue={detail?.referenceContent} maxLength={5000} placeholder="산출물, 작업문서, 참고 링크 등의 내용을 입력하세요." /></label>
    <label>비고<textarea name="notes" rows={3} defaultValue={detail?.notes} maxLength={2000} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={saving || !groups.length}>{saving ? "저장 중…" : mode === "create" ? "등록하기" : "수정 저장"}</button>
  </form></section></div></>;
}
