"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { probabilities, probabilityLabel } from "@/lib/domain/items";
import { acceptanceLabel, acceptanceLabels } from "@/lib/domain/requirements";
import type { RequirementRow } from "@/lib/server/requirements";
import type { ProjectMemberOption } from "@/lib/server/users";
import type { CommonCode } from "@/lib/server/common-codes";

type Options = { members: ProjectMemberOption[]; divisions: CommonCode[]; categories: CommonCode[] };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(value));
}
function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function RequirementInfoPanel({ requirement, options, editing, onEditingChange }: { requirement: RequirementRow; options: Options; editing: boolean; onEditingChange: (value: boolean) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/requirements/${requirement.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requirementId: form.get("requirementId"),
        title: form.get("title"), content: form.get("content"), ownerUserId: form.get("ownerUserId") || null,
        basis: form.get("basis"), precondition: form.get("precondition"), resolution: form.get("resolution"),
        businessMajorCategory: form.get("businessMajorCategory"), businessMiddleCategory: form.get("businessMiddleCategory"), businessMinorCategory: form.get("businessMinorCategory"),
        registrationDate: form.get("registrationDate") || null,
        addedAfterConfirmation: form.get("addedAfterConfirmation") === "" ? null : form.get("addedAfterConfirmation") === "true", notes: form.get("notes"),
        finalCheckNote: form.get("finalCheckNote"), inspectionCriteria: form.get("inspectionCriteria"),
        acceptanceStatus: form.get("acceptanceStatus"), requestDepartment: form.get("requestDepartment"),
        divisionCodeId: form.get("divisionCodeId") || null, categoryCodeId: form.get("categoryCodeId") || null,
        priority: form.get("priority") || null, importance: form.get("importance") || null,
        version: requirement.version,
      }),
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) { setMessage(payload?.error?.message ?? "저장하지 못했습니다."); return; }
    onEditingChange(false); router.refresh();
  }

  if (editing) return (
    <section className="panel form-panel detail-edit">
      <div className="panel-head"><h2>기본 정보 수정</h2><span>버전 {requirement.version}</span></div>
      <form onSubmit={save}>
        <label>요구사항 ID<input name="requirementId" maxLength={100} defaultValue={requirement.requirementId ?? ""} /></label>
        <label>요구사항명<input name="title" required maxLength={200} defaultValue={requirement.title} /></label>
        <label>요구사항내용<textarea name="content" rows={4} maxLength={10000} defaultValue={requirement.content} /></label>
        <div className="form-grid triple">
          <label>업무대분류<input name="businessMajorCategory" maxLength={200} defaultValue={requirement.businessMajorCategory} /></label>
          <label>업무중분류<input name="businessMiddleCategory" maxLength={200} defaultValue={requirement.businessMiddleCategory} /></label>
          <label>업무소분류<input name="businessMinorCategory" maxLength={200} defaultValue={requirement.businessMinorCategory} /></label>
        </div>
        <div className="form-grid">
          <label>요구사항담당자<select name="ownerUserId" defaultValue={requirement.ownerUserId ?? ""}><option value="">미지정</option>{options.members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.userId})</option>)}</select></label>
          <label>요구사항수용구분<select name="acceptanceStatus" defaultValue={requirement.acceptanceStatus}>{Object.entries(acceptanceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        <div className="form-grid">
          <label>요구사항구분<select name="divisionCodeId" defaultValue={requirement.divisionCodeId ?? ""}><option value="">미지정</option>{options.divisions.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select></label>
          <label>요구사항분류<select name="categoryCodeId" defaultValue={requirement.categoryCodeId ?? ""}><option value="">미지정</option>{options.categories.map((code) => <option value={code.id} key={code.id}>{code.label}</option>)}</select></label>
        </div>
        <div className="form-grid">
          <label>중요도<select name="importance" defaultValue={requirement.importance ?? ""}><option value="">미지정</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <label>우선순위<select name="priority" defaultValue={requirement.priority ?? ""}><option value="">미지정</option>{probabilities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        </div>
        <label>요구사항출처<textarea name="basis" rows={3} maxLength={5000} defaultValue={requirement.basis} /></label>
        <label>사전확인사항<textarea name="precondition" rows={3} maxLength={5000} defaultValue={requirement.precondition} /></label>
        <label>요구사항해결방안<textarea name="resolution" rows={3} maxLength={5000} defaultValue={requirement.resolution} /></label>
        <div className="form-grid">
          <label>요구사항요청부서<input name="requestDepartment" maxLength={200} defaultValue={requirement.requestDepartment} /></label>
          <label>등록일자<input type="date" name="registrationDate" defaultValue={toDateInputValue(requirement.registrationDate)} /></label>
        </div>
        <label>최종확인사항<textarea name="finalCheckNote" rows={3} maxLength={5000} defaultValue={requirement.finalCheckNote} /></label>
        <label>확정후추가<select name="addedAfterConfirmation" defaultValue={requirement.addedAfterConfirmation === null ? "" : String(requirement.addedAfterConfirmation)}><option value="">미입력</option><option value="true">예</option><option value="false">아니요</option></select></label>
        <label>비고<textarea name="notes" rows={3} maxLength={5000} defaultValue={requirement.notes} /></label>
        <label>검수기준<textarea name="inspectionCriteria" rows={3} maxLength={5000} defaultValue={requirement.inspectionCriteria} /></label>
        {message && <p className="form-error">{message}</p>}
        <button className="button primary" type="submit" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
      </form>
    </section>
  );

  return (
    <article className="panel detail-summary">
      <div className="detail-badges">
        <span className={`badge ${requirement.acceptanceStatus}`}>{acceptanceLabel(requirement.acceptanceStatus)}</span>
        {requirement.divisionLabel && <span className="badge">{requirement.divisionLabel}</span>}
        {requirement.categoryLabel && <span className="badge">{requirement.categoryLabel}</span>}
      </div>
      <dl>
        <div><dt>요구사항 ID</dt><dd className="mono requirement-id">{requirement.requirementId || "-"}</dd></div>
        <div><dt>요구사항내용</dt><dd className="prewrap">{requirement.content || "-"}</dd></div>
        <div><dt>업무분류</dt><dd>{[requirement.businessMajorCategory, requirement.businessMiddleCategory, requirement.businessMinorCategory].filter(Boolean).join(" › ") || "-"}</dd></div>
        <div><dt>담당자</dt><dd>{requirement.ownerName ?? "미지정"}</dd></div>
        <div><dt>중요도 / 우선순위</dt><dd>{requirement.importance ? probabilityLabel(requirement.importance) : "미지정"} / {requirement.priority ? probabilityLabel(requirement.priority) : "미지정"}</dd></div>
        <div><dt>요구사항출처</dt><dd className="prewrap">{requirement.basis || "-"}</dd></div>
        <div><dt>사전확인사항</dt><dd className="prewrap">{requirement.precondition || "-"}</dd></div>
        <div><dt>요구사항해결방안</dt><dd className="prewrap">{requirement.resolution || "-"}</dd></div>
        <div><dt>요구사항요청부서</dt><dd>{requirement.requestDepartment || "-"}</dd></div>
        <div><dt>등록일자</dt><dd>{requirement.registrationDate ? formatDate(requirement.registrationDate) : "-"}</dd></div>
        <div><dt>최종확인사항</dt><dd className="prewrap">{requirement.finalCheckNote || "-"}</dd></div>
        <div><dt>확정후추가</dt><dd>{requirement.addedAfterConfirmation === null ? "-" : requirement.addedAfterConfirmation ? "예" : "아니요"}</dd></div>
        <div><dt>비고</dt><dd className="prewrap">{requirement.notes || "-"}</dd></div>
        <div><dt>검수기준</dt><dd className="prewrap">{requirement.inspectionCriteria || "-"}</dd></div>
        <div><dt>시스템 등록일</dt><dd>{formatDate(requirement.createdAt)}</dd></div>
      </dl>
    </article>
  );
}
