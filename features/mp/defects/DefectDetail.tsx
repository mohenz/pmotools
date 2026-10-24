"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { getDefectCodes } from "@/lib/server/mp/defects/common";
import type { getDefect } from "@/lib/server/mp/defects/defects";
import { defectApi, json, STATUS_CLASS_BADGE, STATUS_CLASS_LABEL } from "@/features/mp/defects/client";
import { OptionChecks } from "@/features/mp/defects/OptionChecks";
import { AssigneePicker, type AssigneeOption } from "@/features/mp/defects/AssigneePicker";
import { UtEvidencePicker } from "@/features/mp/ut/UtEvidencePicker";
import { fmtDate, fmtDateTime, fmtNumber, SOURCE_LABEL } from "@/features/mp/defects/format";

type Codes = Awaited<ReturnType<typeof getDefectCodes>>;
type Defect = Awaited<ReturnType<typeof getDefect>>;

const ACTION_LABEL: Record<string, string> = { CREATE: "등록", UPDATE: "수정", ASSIGN: "조치자 지정", STATUS: "상태 변경", LINK: "연결 변경", DELETE: "삭제" };
const FIELD_LABEL: Record<string, string> = {
  title: "제목", stepsToRepro: "재현 단계", testStageCodeId: "테스트 단계", screenPath: "화면경로", menuName: "메뉴명", screenName: "화면명", screenUrl: "화면 URL", envInfo: "환경",
  statusCodeId: "상태", identificationCodeId: "결함식별", actionComment: "조치 내용", actionDueDate: "조치 예정일", actionStartDate: "조치 시작일", actionEndDate: "조치 종료일",
  severityCodeId: "심각도", priorityCodeId: "우선순위", assigneeUserId: "조치자", caseId: "케이스", wbsItemId: "WBS Task", groupId: "업무단위", sourceType: "등록 경로", evidence: "증적", isActive: "사용",
};

// DM-03 — 단위테스트 정보 화면(.ut-edit)과 같은 배치. 권한(permissions)에 따라 입력칸을 열고 닫으며, 실제 권한 검사는 서버가 한다.
export function DefectDetail({ defect, codes, members }: { defect: Defect; codes: Codes; members: AssigneeOption[] }) {
  const router = useRouter();
  const p = defect.permissions;
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [identificationId, setIdentificationId] = useState(defect.identification?.id ?? "");
  const [severityId, setSeverityId] = useState(defect.severity.id);
  const [priorityId, setPriorityId] = useState(defect.priority?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(defect.assignee?.id ?? "");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message?.tone === "error") messageRef.current?.focus(); }, [message]); // 실패 시 오류 안내로 포커스 이동

  function run(path: string, init: RequestInit, done: string, after?: () => void) {
    setPending(true); setMessage(null);
    defectApi(path, init).then(() => { setMessage({ tone: "ok", text: done }); after?.(); router.refresh(); }).catch((e: Error) => setMessage({ tone: "error", text: e.message })).finally(() => setPending(false));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const get = (k: string) => (f.has(k) ? String(f.get(k) ?? "") : undefined);
    const body: Record<string, unknown> = { version: defect.version };
    const set = (k: string, v: unknown) => { if (v !== undefined) body[k] = v; };
    if (p.editBasic) { for (const k of ["title", "stepsToRepro", "screenPath", "menuName", "screenName", "screenUrl", "envInfo", "testStageCodeId"]) set(k, get(k)); }
    if (p.editSeverity) set("severityCodeId", get("severityCodeId"));
    if (p.editPriority) set("priorityCodeId", get("priorityCodeId") || null);
    if (p.editAction) {
      set("statusCodeId", get("statusCodeId")); set("identificationCodeId", get("identificationCodeId") || null); set("actionComment", get("actionComment"));
      for (const k of ["actionDueDate", "actionStartDate", "actionEndDate"]) set(k, get(k) || null);
    }
    // 조치자를 바꿨다면 먼저 지정하고(버전 +1), 이어서 나머지 항목을 저장한다. 팝업에서 고르기만 해서는 저장되지 않는다.
    const assigneeChanged = p.assign && assigneeId !== (defect.assignee?.id ?? "");
    setPending(true); setMessage(null);
    (async () => {
      let version = defect.version;
      if (assigneeChanged) { await defectApi(`items/${defect.id}/assign`, json("POST", { assigneeUserId: assigneeId || null, version })); version += 1; }
      body.version = version;
      await defectApi(`items/${defect.id}`, json("PATCH", body));
    })().then(() => { setMessage({ tone: "ok", text: "저장했습니다." }); router.refresh(); }).catch((e: Error) => setMessage({ tone: "error", text: e.message })).finally(() => setPending(false));
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newFiles.length) { setMessage({ tone: "error", text: "올릴 증적 파일을 선택해 주세요." }); return; }
    const big = newFiles.find((f) => f.size > 20 * 1024 * 1024);
    if (big) { setMessage({ tone: "error", text: `${big.name}: 파일은 20MB 이하만 올릴 수 있습니다.` }); return; }
    const body = new FormData();
    newFiles.forEach((f) => body.append("files", f));
    run(`items/${defect.id}/evidence`, { method: "POST", body }, "증적을 올렸습니다.", () => setNewFiles([]));
  }

  const codeOptions = (list: { id: string; label: string }[]) => list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>);
  const canSave = p.editBasic || p.editAction || p.editSeverity || p.editPriority;

  return <>
    <section className="ut-stage" role="status" aria-live="polite" aria-label="결함 상태">
      <span className={`badge ${STATUS_CLASS_BADGE[defect.status.statusClass]}`}>{defect.status.label} · {STATUS_CLASS_LABEL[defect.status.statusClass]}</span>
      {defect.isUnresolvedMajor && <span className="badge band-red">미조치 중대 결함</span>}
      <span className="ut-hint">등록 {defect.creator.name} · {fmtDate(defect.createdAt)} · {SOURCE_LABEL[defect.sourceType] ?? defect.sourceType} · 담당 {defect.assignee?.name ?? "미배정"}</span>
    </section>
    {message && <p ref={messageRef} tabIndex={-1} className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role={message.tone === "error" ? "alert" : "status"} aria-live="polite">{message.text}</p>}
    {!canSave && <p className="ut-hint">이 결함은 조회만 할 수 있습니다.</p>}

    <form className="panel form-panel" onSubmit={save}>
      <fieldset disabled={pending} className="ut-fieldset">
        <h2 className="ut-section">결함 정보</h2>
        <div className="form-grid">
          <label className="span-2">제목<input name="title" autoComplete="off" defaultValue={defect.title} minLength={5} maxLength={255} readOnly={!p.editBasic} /></label>
          <label>테스트 단계<select name="testStageCodeId" defaultValue={defect.testStage.id} disabled={!p.editBasic}>{codeOptions(codes.stages.some((s) => s.id === defect.testStage.id) ? codes.stages : [...codes.stages, { id: defect.testStage.id, label: `${defect.testStage.label} (잠금)` }])}</select></label>
          <OptionChecks name="identificationCodeId" label="결함식별" options={codes.identifications} value={identificationId} onChange={setIdentificationId} disabled={!p.editAction || pending} allowEmpty />
          <OptionChecks name="severityCodeId" label="심각도" options={codes.severities} value={severityId} onChange={setSeverityId} disabled={!p.editSeverity || pending} />
          <OptionChecks name="priorityCodeId" label="우선순위" options={codes.priorities} value={priorityId} onChange={setPriorityId} disabled={!p.editPriority || pending} allowEmpty />
          <label className="span-2">재현 단계<textarea name="stepsToRepro" rows={5} defaultValue={defect.stepsToRepro} readOnly={!p.editBasic} /></label>
        </div>

        <h2 className="ut-section">화면 정보</h2>
        <div className="form-grid">
          <label className="span-2">화면 URL<input name="screenUrl" type="url" inputMode="url" autoComplete="off" defaultValue={defect.screenUrl} readOnly={!p.editBasic} /></label>
          <label>화면경로<input name="screenPath" autoComplete="off" defaultValue={defect.screenPath} readOnly={!p.editBasic} /></label>
          <label>화면명<input name="screenName" autoComplete="off" defaultValue={defect.screenName} readOnly={!p.editBasic} /></label>
          <label>메뉴명<input name="menuName" autoComplete="off" defaultValue={defect.menuName} readOnly={!p.editBasic} /></label>
          <label>환경<input name="envInfo" autoComplete="off" defaultValue={defect.envInfo} readOnly={!p.editBasic} /></label>
        </div>

        <h2 className="ut-section">조치</h2>
        <div className="form-grid">
          {p.assign && <div className="ut-field span-2"><span>조치자</span><AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} disabled={pending} /></div>}
          <div className="span-2 defect-action-row">
            <label>상태<select name="statusCodeId" defaultValue={defect.status.id} disabled={!p.editAction}>{codes.statuses.map((s) => <option key={s.id} value={s.id}>{s.label} ({STATUS_CLASS_LABEL[s.statusClass]})</option>)}</select></label>
            <label>조치 예정일<input type="date" name="actionDueDate" defaultValue={defect.actionDueDate ?? ""} readOnly={!p.editAction} /></label>
            <label>조치 시작일<input type="date" name="actionStartDate" defaultValue={defect.actionStartDate ?? ""} readOnly={!p.editAction} /></label>
            <label>조치 종료일<input type="date" name="actionEndDate" defaultValue={defect.actionEndDate ?? ""} readOnly={!p.editAction} /></label>
          </div>
          <label className="span-2">조치 내용<textarea name="actionComment" rows={4} defaultValue={defect.actionComment} readOnly={!p.editAction} /></label>
        </div>
      </fieldset>
      {canSave && <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? "저장 중…" : "저장"}</button></div>}
    </form>

    <section className="panel form-panel">
      <h2 className="ut-section">증적 ({defect.evidences.length}/3)</h2>
      {defect.evidences.length ? <ul className="defect-file-list">{defect.evidences.map((e) => <li key={e.id}>
        {e.mimeType.startsWith("image/") ? <button type="button" className="button secondary sm" onClick={() => setPreview(preview === e.id ? null : e.id)}>{e.fileName}</button> : <a className="table-link" href={`/api/v1/mp/defects/evidences/${e.id}`} target="_blank" rel="noreferrer">{e.fileName}</a>}
        <span className="ut-hint">{fmtNumber(Math.ceil(e.sizeBytes / 1024))}KB · {fmtDate(e.createdAt)}</span>
      </li>)}</ul> : <p className="ut-hint">첨부된 증적이 없습니다.</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img className="defect-evidence-image" src={`/api/v1/mp/defects/evidences/${preview}`} alt="결함 증적 이미지" />}
      {p.editBasic && defect.evidences.length < 3 && <form onSubmit={upload}><UtEvidencePicker files={newFiles} onChange={(f) => setNewFiles(f.slice(0, 3 - defect.evidences.length))} disabled={pending} /><div className="form-actions"><button className="button secondary" type="submit" disabled={pending || !newFiles.length}>{pending ? "올리는 중…" : "증적 올리기"}</button></div></form>}
    </section>

    <section className="panel compact">
      <h2 className="ut-section">이력 <span className="ut-hint">(수정·삭제할 수 없는 기록)</span></h2>
      <div className="table-wrap"><table className="ut-table defect-history"><thead><tr><th>일시</th><th>구분</th><th>처리자</th><th>변경 내용</th></tr></thead>
        <tbody>{defect.histories.map((h) => <tr key={h.id}><td>{fmtDateTime(h.createdAt)}</td><td>{ACTION_LABEL[h.action] ?? h.action}</td><td>{h.actorName}</td>
          <td>{Object.entries((h.changedData ?? {}) as Record<string, { before: unknown; after: unknown }>).map(([k, v]) => <div key={k}>{FIELD_LABEL[k] ?? k}: {String(v?.before ?? "–").slice(0, 60)} → {String(v?.after ?? "–").slice(0, 60)}</div>)}</td></tr>)}</tbody></table></div>
    </section>

    {p.delete && <section className="panel form-panel">
      <h2 className="ut-section">결함 삭제</h2>
      <p className="ut-hint">삭제하면 목록과 통계에서 빠지지만 이력은 남습니다.</p>
      <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Trigger asChild><button className="button danger" type="button" disabled={pending}>결함 삭제</button></AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="calendar-modal-backdrop" />
          <AlertDialog.Content className="alert-dialog" role="alertdialog">
            <AlertDialog.Title asChild><h2>{defect.displayId} 삭제</h2></AlertDialog.Title>
            <AlertDialog.Description asChild><p>이 결함을 삭제합니다. 목록과 통계에서 사라지고 이력만 남습니다.</p></AlertDialog.Description>
            <div className="alert-dialog-actions">
              <AlertDialog.Cancel asChild><button className="button secondary" type="button">취소</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button className="button danger" type="button" onClick={() => run(`items/${defect.id}`, json("DELETE"), "삭제했습니다.", () => router.push("/mp-defects"))}>결함 삭제</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>}
  </>;
}
