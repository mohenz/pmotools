"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { probabilities } from "@/lib/domain/items";
import { acceptanceLabels } from "@/lib/domain/requirements";
import type { ProjectMemberOption } from "@/lib/server/users";
import type { CommonCode } from "@/lib/server/common-codes";

type Options = { members: ProjectMemberOption[]; divisions: CommonCode[]; categories: CommonCode[] };

export function RequirementCreateScreen({ options }: { options: Options }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/requirements", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"), content: form.get("content"), ownerUserId: form.get("ownerUserId") || null,
        basis: form.get("basis"), precondition: form.get("precondition"), resolution: form.get("resolution"),
        acceptanceStatus: form.get("acceptanceStatus"), requestDepartment: form.get("requestDepartment"),
        divisionCodeId: form.get("divisionCodeId") || null, categoryCodeId: form.get("categoryCodeId") || null,
        priority: form.get("priority") || null, importance: form.get("importance") || null,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "등록하지 못했습니다."); setSaving(false); return;
    }
    router.push("/requirements"); router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>요구사항 등록</h1><p>요구사항정의서 신규 항목 생성</p></div></header>
    <div className="content"><section className="panel form-panel"><form onSubmit={submit}>
      <label>요구사항명<input name="title" required maxLength={200} placeholder="예: 회의실 예약 충돌 방지" /></label>
      <label>요구사항내용<textarea name="content" rows={4} maxLength={10000} placeholder="요구사항의 상세 내용을 기술" /></label>
      <div className="form-grid">
        <label>요구사항담당자<select name="ownerUserId" defaultValue=""><option value="">미지정</option>{options.members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.userId})</option>)}</select></label>
        <label>요구사항수용구분<select name="acceptanceStatus" defaultValue="pending">{Object.entries(acceptanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <div className="form-grid">
        <label>요구사항구분<select name="divisionCodeId" defaultValue=""><option value="">미지정</option>{options.divisions.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select></label>
        <label>요구사항분류<select name="categoryCodeId" defaultValue=""><option value="">미지정</option>{options.categories.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select></label>
      </div>
      <div className="form-grid">
        <label>우선순위<select name="priority" defaultValue=""><option value="">미지정</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label>중요도<select name="importance" defaultValue=""><option value="">미지정</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      </div>
      <label>요구사항근거<textarea name="basis" rows={3} maxLength={5000} placeholder="관련 규정, 요청 부서, 근거 자료 등" /></label>
      <label>요구사항선결사항<textarea name="precondition" rows={3} maxLength={5000} placeholder="이 요구사항을 처리하기 위해 먼저 충족되어야 하는 조건" /></label>
      <label>요구사항해결방안<textarea name="resolution" rows={3} maxLength={5000} placeholder="적용 예정이거나 검토 중인 해결 방안" /></label>
      <label>요구사항요청부서<input name="requestDepartment" maxLength={200} placeholder="예: 현업 운영팀" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit" disabled={saving}>{saving ? "등록 중…" : "등록하기"}</button>
    </form></section></div>
  </>;
}
