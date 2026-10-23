"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CASE_DISPLAY_ID_MAX, UT_NO_WBS, UT_DEFECT_STATUS_LABEL, UT_VERDICT_LABEL, UT_VERIFICATION_LABEL, type UtVerdict, type UtVerificationResult } from "@/lib/domain/ut";
import type { getUtCaseEditor, UtTreeNode } from "@/lib/server/mp/ut/grid";
import type { getUtFormOptions } from "@/lib/server/mp/ut/cases";
import { UtEvidencePicker } from "@/features/mp/ut/UtEvidencePicker";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot, today } from "@/features/mp/ut/format";

type Editor = Awaited<ReturnType<typeof getUtCaseEditor>>;
type Options = Awaited<ReturnType<typeof getUtFormOptions>>;

// 단위테스트 정보확인/처리 — 케이스 정보 입력·수정, 판정·증적 등록, QC·PL 확인, 결함 등록·조치·검증, 이력(2026-10-20 화면 2개 체계).
// 시나리오 없이 케이스가 WBS Task에 바로 속한다(2026-10-21 사용자 확정).
export type UtCaseNavParams = { caseId?: string; wbs?: string };
export type UtCaseModalControl = { close: () => void; reload: () => void; open: (params: UtCaseNavParams) => void };

export function UtCaseScreen({ editor, options, leaves, projectCode, userId, modal }: { editor: Editor; options: Options; leaves: UtTreeNode[]; projectCode: string; userId: string; modal?: UtCaseModalControl }) {
  const router = useRouter();
  // 모달로 열렸으면 목록을 떠나지 않고 모달 안에서 이동·갱신한다(2026-10-20 사용자 요청).
  const refresh = () => { modal?.reload(); router.refresh(); };
  const goTo = (params: UtCaseNavParams) => {
    if (modal) return modal.open(params);
    if (params.caseId) return router.push(`/mp-ut/cases/${params.caseId}`);
    router.replace(`/mp-ut/cases/new?wbs=${params.wbs ?? ""}`);
  };
  const { case: c } = editor;
  // 신규 등록에서는 Leaf WBS만 미리 채운다(트리에서 상위 WBS를 고른 상태로 열 수 있음).
  const [wbsItemId, setWbsItemId] = useState(editor.wbsItemId && (c || editor.wbsItemId === UT_NO_WBS || leaves.some((l) => l.id === editor.wbsItemId)) ? editor.wbsItemId : "");
  const noWbs = editor.wbsItemId === UT_NO_WBS;
  const fixedLeaf = leaves.find((l) => l.id === editor.wbsItemId) ?? null;
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [openDefect, setOpenDefect] = useState<{ id: string; kind: "fix" | "verify" } | null>(null);
  const latest = c?.executions[0] ?? null;
  const [execVerdict, setExecVerdict] = useState<UtVerdict>("PASS");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const historyExec = c?.executions.find((x) => x.id === historyId) ?? null;
  const [preview, setPreview] = useState<{ id: string; fileName: string } | null>(null);
  // 이미지 증적은 새 탭 대신 팝업으로 보여 준다(2026-10-23 사용자 요청). 이미지가 아니면 기존처럼 새 탭에서 연다.
  const openEvidence = (ev: MouseEvent<HTMLAnchorElement>, x: { id: string; fileName: string }) => { if (isImageFile(x.fileName)) { ev.preventDefault(); setPreview({ id: x.id, fileName: x.fileName }); } };
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [caseTypeId, setCaseTypeId] = useState(c?.caseTypeCodeId ?? "");

  async function act(fn: () => Promise<unknown>, done: string) {
    setPending(true); setMessage(null);
    try { await fn(); if (done) setMessage({ tone: "ok", text: done }); setOpenDefect(null); refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }
  const formValues = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const f = new FormData(event.currentTarget); return { f, v: (n: string) => ((f.get(n) as string) ?? "").trim() }; };
  const readOnly = !editor.editable;
  const members = options.members;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseTypeId) { setMessage({ tone: "error", text: "케이스유형을 선택해 주세요." }); return; }
    setPending(true); setMessage(null);
    const f = new FormData(event.currentTarget);
    const v = (n: string) => ((f.get(n) as string) ?? "").trim();
    const data = {
      displayId: v("displayId"), caseTypeCodeId: v("caseTypeCodeId"), groupId: v("groupId"), screenId: v("screenId"), screenName: v("screenName"), screenUrl: v("screenUrl"), requirementId: v("requirementId") || null, plUserId: v("plUserId") || null,
      name: v("caseName"), precondition: v("precondition"), steps: v("steps"), inputData: v("inputData"), expectedResult: v("expectedResult"),
      executorId: v("executorId") || null, qcUserId: v("qcUserId") || null, plannedDate: v("plannedDate") || null,
    };
    try {
      if (c) { await utApi(`cases/${c.id}`, json("PATCH", { ...data, version: c.version })); setMessage({ tone: "ok", text: "저장" }); refresh(); }
      else { const created = await utApi<{ id: string }>("cases", json("POST", { wbsItemId: wbsItemId === UT_NO_WBS ? null : wbsItemId, ...data })); router.refresh(); goTo({ caseId: created.id }); }
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  return <>
    <header className="topbar">
      <div><h1>테스트 케이스 정보</h1><p>{c ? <><span className="mono">{c.displayId}</span></> : "신규 케이스"}</p></div>
      <div className="topbar-actions">
        {c && editor.wbsItemId && <button type="button" className="button secondary" onClick={() => goTo({ wbs: editor.wbsItemId! })}>+ 같은 WBS에 케이스 추가</button>}
        {modal ? <button type="button" className="button secondary" onClick={modal.close}>닫기</button> : <Link className="button secondary" href={`/mp-ut${editor.wbsItemId ? `?wbs=${editor.wbsItemId}` : ""}`}>목록</Link>}
      </div>
    </header>
    <div className="content ut-edit">
      {c && <section className="ut-stage" role="status" aria-live="polite" aria-label="수행·승인 단계">
        {latest && <span className="ut-stage-round">{latest.roundNo}차</span>}
        {(() => { const t = runOf(latest); return <span className={`ut-stage-chip ${t.tone}`}>{t.text}</span>; })()}
        {latest && (["QC", "PL"] as const).map((step) => { const t = stageOf(latest, step); return <span key={step} className={`ut-stage-chip ${t.tone}`}>{t.text}</span>; })}
      </section>}
      {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
      {readOnly && <p className="ut-hint">수행 결과를 등록하기 전의 케이스만 작성자 또는 PM/PMO가 수정할 수 있습니다.</p>}
      <form className="panel form-panel" onSubmit={save}>
        <fieldset disabled={readOnly || pending} className="ut-fieldset">
          {/* 화면 노출 순서(2026-10-23 사용자 확정): 프로젝트코드·업무단위·요구사항ID → WBS ID·작업자 → 테스트케이스ID·테스트케이스명 → 테스트유형·화면ID·화면명 → 이후 사전조건부터 기존 순서.
              목록의 대상 Task 행에서 열면 Task가 정해져 있으므로 WBS는 선택 없이 표시만 한다. */}
          <div className="form-grid">
            <label>프로젝트 코드<input value={projectCode} readOnly /></label>
            <label>업무단위<select name="groupId" required defaultValue={c?.groupId ?? ""}><option value="" disabled>선택</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
            <label>요구사항 ID(선택)<select name="requirementId" defaultValue={c?.requirementId ?? ""}><option value="">미지정</option>{options.requirements.map((r) => <option key={r.id} value={r.id}>{r.displayId} {r.title}</option>)}</select></label>
          </div>
          <div className="form-grid">
            {c ? <label>WBS ID<input value={c.wbsDisplayId ? `${c.wbsDisplayId} ${c.wbsName}` : "WBS 없음"} readOnly /></label>
            : noWbs ? <label>WBS ID<input value="WBS 없음" readOnly /></label>
            : fixedLeaf ? <label>WBS ID<input value={`${fixedLeaf.displayId} · ${fixedLeaf.code} ${fixedLeaf.name}`} readOnly /></label>
            : /* 등록 경로(목록 행·좌측 메뉴·상단 버튼)와 관계없이 같은 배치 — WBS가 정해지지 않았을 때만 한 줄 선택(2026-10-21 사용자 요청). 선택해도 입력값은 유지된다. */
            <label>WBS ID<select required value={wbsItemId} onChange={(e) => setWbsItemId(e.target.value)}>
              <option value="" disabled>WBS 선택(단위테스트 대상 Task)</option>
              <option value={UT_NO_WBS}>WBS 없음 (WBS ID 없이 등록)</option>
              {leaves.map((l) => <option key={l.id} value={l.id}>{l.displayId} · {l.code} {l.name}</option>)}
            </select></label>}
            {/* 작업자 — WBS Task 담당자(읽기 전용, WBS에서 지정) */}
            <label>작업자<input value={(c ? c.wbsOwnerName : leaves.find((l) => l.id === (fixedLeaf?.id ?? wbsItemId))?.ownerName) || "–"} readOnly /></label>
          </div>
          <div className="form-grid">
            <label>테스트케이스ID<input name="displayId" required maxLength={CASE_DISPLAY_ID_MAX} pattern="\S+" title="공백 없이 입력" defaultValue={c?.displayId ?? ""} placeholder="예: UTC-2026-003042-001 (직접 입력, 프로젝트 내 중복 불가)" /></label>
            <label>테스트케이스명<input name="caseName" required maxLength={200} defaultValue={c?.name ?? ""} placeholder="검증 규칙 1개를 한 줄로" /></label>
          </div>
          <div className="form-grid">
            {/* 테스트유형(케이스유형) — 공통코드 ut_case_type(화면·기능·API), 필수(2026-10-21 사용자 확정) */}
            <div className="ut-field"><span>테스트유형</span><SingleChecks label="테스트유형" items={options.codes.caseTypes.map((x) => ({ value: x.id, label: x.label }))} value={caseTypeId || null} onChange={setCaseTypeId} /><input type="hidden" name="caseTypeCodeId" value={caseTypeId} /></div>
            {/* 화면ID·화면명 — 수기 입력(2026-10-21 사용자 확정, 프로그램 목록 선택 대체) */}
            <label>화면ID<input name="screenId" maxLength={100} defaultValue={c?.screenId ?? ""} placeholder="예: SCR-ORD-001" /></label>
            <label>화면명<input name="screenName" maxLength={200} defaultValue={c?.screenName ?? ""} placeholder="예: 주문서 작성" /></label>
          </div>
          <label>화면 URL<input name="screenUrl" maxLength={500} defaultValue={c?.screenUrl ?? ""} placeholder="예: https://example.com/orders/new" /></label>

          <label>사전조건<textarea name="precondition" rows={4} maxLength={2000} defaultValue={c?.precondition ?? ""} /></label>
          <label>입력데이터<textarea name="inputData" rows={4} maxLength={2000} defaultValue={c?.inputData ?? ""} /></label>
          <label>테스트스텝<textarea name="steps" rows={4} maxLength={4000} defaultValue={c?.steps ?? ""} placeholder={"1. …\n2. …"} /></label>
          <label>예상결과<textarea name="expectedResult" rows={4} maxLength={1000} defaultValue={c?.expectedResult ?? ""} placeholder="확인 가능한 결과" /></label>
          {/* 실제결과·테스트결과는 아래 '테스트 수행 결과 등록'에서 차수별로 입력(증적 첨부)하며, 여기서는 최근 차수를 보여 준다. */}
          <label>실제결과<textarea rows={4} readOnly value={latest ? (latest.verdict === "NA" ? latest.naReason : latest.actualResult) || "–" : "수행 전"} /></label>
          <div className="ut-field">
            <span>테스트결과{latest ? ` (${latest.roundNo}차)` : " (수행 전)"}</span>
            <VerdictChecks value={latest?.verdict ?? null} disabled />
          </div>
          <div className="form-grid">
            <label>수행담당자<select name="executorId" defaultValue={c?.executorId ?? userId}><option value="">미지정</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>테스트예정일<input type="date" name="plannedDate" defaultValue={c?.plannedDate ?? ""} /></label>
          </div>
          <div className="form-grid">
            <label>QC확인자<select name="qcUserId" defaultValue={c?.qcUserId ?? ""}><option value="">미지정</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>PL확인자<select name="plUserId" defaultValue={c?.plUserId ?? ""}><option value="">미지정</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          </div>

          <div className="form-actions"><button className="button primary" disabled={pending || (!c && !wbsItemId)}>{pending ? "저장 중…" : "저장"}</button></div>
        </fieldset>
      </form>

      {editor.canExecute && c && <section className="panel">
        <div className="panel-head"><h2>테스트 수행 결과 등록</h2><span>{latest ? `${latest.roundNo + 1}차` : "1차"} · 증적 필수(Pass·Fail)</span></div>
        <form className="ut-exec-form" onSubmit={(e) => { e.preventDefault(); const body = new FormData(e.currentTarget); evidenceFiles.forEach((f) => body.append("evidence", f, f.name)); void act(async () => { await utApi(`cases/${c.id}/executions`, { method: "POST", body }); setEvidenceFiles([]); }, "수행 등록"); }}>
          <div className="ut-field"><span>테스트 결과</span><VerdictChecks value={execVerdict} onChange={setExecVerdict} /><input type="hidden" name="verdict" value={execVerdict} /></div>
          <div className="form-grid">
            <label>테스트 수행일<input type="date" name="executedOn" defaultValue={today()} /></label>
            <label>수행 환경<select name="envCodeId" defaultValue=""><option value="">미지정</option>{options.codes.envs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          </div>
          <label>실제결과(FAIL 필수)<textarea name="actualResult" rows={4} /></label>
          <label>N/A 사유(N/A 필수)<input name="naReason" maxLength={1000} /></label>
          <UtEvidencePicker files={evidenceFiles} onChange={setEvidenceFiles} disabled={pending} />
          <div className="form-actions"><button className="button primary" disabled={pending}>등록</button></div>
        </form>
      </section>}

      {(editor.canQc || editor.canPl) && latest && <section className="panel">
        <div className="panel-head"><h2>{editor.canQc ? "QC 확인" : "PL 확인"}</h2><span>{latest.roundNo}차 {UT_VERDICT_LABEL[latest.verdict]} · 증적을 모두 열람하면 승인할 수 있습니다</span></div>
        <dl className="ut-dl">
          <div><dt>예상결과</dt><dd>{c?.expectedResult || "–"}</dd></div>
          <div><dt>{latest.verdict === "NA" ? "N/A 사유" : "실제결과"}</dt><dd>{(latest.verdict === "NA" ? latest.naReason : latest.actualResult) || "–"}</dd></div>
          <div><dt>증적</dt><dd>{latest.evidences.length ? latest.evidences.map((x) => <a key={x.id} className={`table-link ut-file${x.viewed || viewed.has(x.id) ? " viewed" : ""}`} href={`/api/v1/mp/ut/evidences/${x.id}`} target="_blank" rel="noreferrer" onClick={(ev) => { setViewed((s0) => new Set(s0).add(x.id)); openEvidence(ev, x); }}>{x.viewed || viewed.has(x.id) ? "✔ " : ""}{x.fileName}</a>) : "–"}</dd></div>
        </dl>
        <form className="ut-decide" onSubmit={(e) => { const { v } = formValues(e); const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "APPROVED"; void act(() => utApi(`executions/${latest.id}/approval`, json("POST", { step: editor.canQc ? "QC" : "PL", decision, rejectReasonCodeId: v("rejectReasonCodeId") || null, comment: v("comment") })), ""); }}>
          <label>반려 사유<select name="rejectReasonCodeId" defaultValue=""><option value="">(반려 시 선택)</option>{options.codes.rejectReasons.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label>의견<input className="ut-comment-input" name="comment" maxLength={2000} /></label>
          <button className="button primary" name="decision" value="APPROVED" disabled={pending || !(latest.verdict === "NA" || (latest.evidences.length > 0 && latest.evidences.every((x) => x.viewed || viewed.has(x.id))))}>승인</button>
          <button className="button secondary" name="decision" value="REJECTED" disabled={pending}>반려</button>
        </form>
      </section>}

      {/* 결함 영역은 항상 표시(2026-10-21 사용자 요청) — 등록은 최근 테스트결과가 FAIL일 때만 가능 */}
      <section className="panel">
        <div className="panel-head"><h2>결함</h2><span>결함 ID · 조치일 · 조치자 · 검증결과 · 검증일자 · 검증자</span></div>
        {!c ? <p className="ut-hint">케이스를 저장한 뒤 결함을 등록할 수 있습니다.</p>
        : !c.defects.length ? <p className="ut-hint">등록된 결함이 없습니다.{editor.canRegisterDefect ? "" : " 결함은 최근 테스트결과가 FAIL일 때 수행 담당자·QC·PL·PM/PMO가 등록합니다."}</p>
        : <div className="table-wrap"><table className="ut-table">
          <thead><tr><th>결함 ID</th><th>상태</th><th>오류내용</th><th>조치 담당</th><th>조치일</th><th>조치자</th><th>검증결과</th><th>검증일자</th><th>검증자</th><th /></tr></thead>
          <tbody>{c.defects.map((d) => [
            <tr key={d.id}>
              <td className="mono">{d.displayId}</td>
              <td><span className={`badge ${STATUS_BAND[d.status]}`}>{UT_DEFECT_STATUS_LABEL[d.status]}</span></td>
              <td className="ut-pre">{d.description}</td>
              <td>{d.assigneeName ?? "수행 담당자"}</td>
              <td>{dot(d.fixedAt)}</td><td>{d.fixerName ?? "–"}</td>
              <td>{d.verificationResult ? UT_VERIFICATION_LABEL[d.verificationResult as UtVerificationResult] : "–"}</td><td>{dot(d.verifiedAt)}</td><td>{d.verifierName ?? "–"}</td>
              <td className="ut-actions">
                {d.canFix && <button className="button primary" type="button" onClick={() => setOpenDefect({ id: d.id, kind: "fix" })}>조치</button>}
                {d.canVerify && <button className="button primary" type="button" onClick={() => setOpenDefect({ id: d.id, kind: "verify" })}>검증</button>}
              </td>
            </tr>,
            openDefect?.id === d.id && <tr key={`${d.id}-form`}><td colSpan={10}>
              <form className="ut-decide" onSubmit={(e) => { const { v } = formValues(e); void act(() => utApi(`defects/${d.id}/${openDefect.kind}`, json("POST", openDefect.kind === "fix" ? { fixedAt: v("date"), note: v("note"), version: d.version } : { result: v("result"), verifiedAt: v("date"), note: v("note"), version: d.version })), openDefect.kind === "fix" ? "조치 등록" : "검증 등록"); }}>
                {openDefect.kind === "verify" && <label>검증결과<select name="result" defaultValue="PASS"><option value="PASS">적합</option><option value="FAIL">부적합(재조치)</option></select></label>}
                <label>{openDefect.kind === "fix" ? "조치일" : "검증일자"}<input type="date" name="date" required defaultValue={today()} /></label>
                <label>{openDefect.kind === "fix" ? "조치 내용" : "검증 의견(부적합 시 필수)"}<input name="note" maxLength={2000} /></label>
                <button className="button primary" disabled={pending}>등록</button>
                <button className="button secondary" type="button" onClick={() => setOpenDefect(null)}>취소</button>
              </form>
            </td></tr>,
            d.actions.length > 0 && <tr key={`${d.id}-hist`}><td colSpan={10}><small className="ut-hint">이력: {d.actions.map((a) => `${dot(a.actedOn)} ${a.actionType === "FIX" ? "조치" : `검증(${a.verificationResult ? UT_VERIFICATION_LABEL[a.verificationResult as UtVerificationResult] : ""})`} ${a.actorName}${a.note ? ` — ${a.note}` : ""}`).join(" / ")}</small></td></tr>,
          ])}</tbody>
        </table></div>}
        {c && editor.canRegisterDefect && latest && <form className="ut-exec-form" onSubmit={(e) => { const { v } = formValues(e); void act(() => utApi(`executions/${latest.id}/defects`, json("POST", { description: v("description"), severity: v("severity"), defectTypeCodeId: v("defectTypeCodeId") || null, causeGroupId: v("causeGroupId") || null, vendorGroupId: v("vendorGroupId") || null, assigneeId: v("assigneeId") || null })), "결함 등록"); }}>
          <strong>결함 등록 — {latest.roundNo}차 FAIL</strong>
          <label>오류내용<textarea name="description" rows={2} required defaultValue={latest.actualResult} /></label>
          <div className="form-grid triple">
            <label>심각도<select name="severity" defaultValue="MAJOR"><option value="CRITICAL">Critical</option><option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="TRIVIAL">Trivial</option></select></label>
            <label>결함 유형<select name="defectTypeCodeId" defaultValue=""><option value="">미지정</option>{options.codes.defectTypes.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
            <label>조치 담당자<select name="assigneeId" defaultValue=""><option value="">수행 담당자</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          </div>
          <div className="form-grid">
            <label>원인 업무단위<select name="causeGroupId" defaultValue=""><option value="">미지정</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
            <label>협력사{options.companies.length ? "(필수)" : ""}<select name="vendorGroupId" defaultValue="" required={options.companies.length > 0}><option value="">미지정</option>{options.companies.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
          </div>
          <div className="form-actions"><button className="button primary" disabled={pending}>결함 등록</button></div>
        </form>}
      </section>

      {c && c.executions.length > 0 && <section className="panel">
        <div className="panel-head"><h2>수행 이력</h2><span>차수별 테스트 결과·QC/PL 확인 · 증적은 "결과 보기" 팝업에서 확인</span></div>
        <div className="table-wrap"><table className="ut-table"><thead><tr><th>차수</th><th>판정</th><th>테스트수행일</th><th>담당자</th><th>실제결과/N/A 사유</th><th>QC 확인</th><th>PL 확인</th><th>상세</th></tr></thead><tbody>
          {c.executions.map((e) => <tr key={e.id}><td>{e.roundNo}</td><td><span className={`badge ${STATUS_BAND[e.verdict]}`}>{UT_VERDICT_LABEL[e.verdict]}</span></td><td>{dot(e.executedOn)}</td><td>{e.executorName}</td><td className="ut-pre">{e.actualResult || e.naReason || "–"}</td>
            <td><ApprovalCell execution={e} step="QC" /></td><td><ApprovalCell execution={e} step="PL" /></td>
            <td><button type="button" className="button secondary" onClick={() => setHistoryId(e.id)}>결과 보기</button></td></tr>)}
        </tbody></table></div>
      </section>}
      {historyExec && <UtHistoryDialog execution={historyExec} onClose={() => setHistoryId(null)} onOpenEvidence={openEvidence} />}
      {preview && <UtImagePreview image={preview} onClose={() => setPreview(null)} />}
    </div>
  </>;
}

type Execution = NonNullable<Editor["case"]>["executions"][number];

/** 수행 이력 상세 팝업 — 차수별 결과·증적·QC/PL 확인(2026-10-23 사용자 요청: 목록에는 첨부파일을 보이지 않는다). */
function UtHistoryDialog({ execution: e, onClose, onOpenEvidence }: { execution: Execution; onClose: () => void; onOpenEvidence: (ev: MouseEvent<HTMLAnchorElement>, x: { id: string; fileName: string }) => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return createPortal(<div className="modal-backdrop ut-evidence-backdrop" role="dialog" aria-modal="true" aria-label={`${e.roundNo}차 수행 결과`} onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
    <div className="modal-card ut-history-modal">
      <h2>{e.roundNo}차 수행 결과</h2>
      <table className="ut-table ut-history-table"><tbody>
        <tr><th scope="row">판정</th><td><span className={`badge ${STATUS_BAND[e.verdict]}`}>{UT_VERDICT_LABEL[e.verdict]}</span></td></tr>
        <tr><th scope="row">테스트수행일</th><td>{dot(e.executedOn)}</td></tr>
        <tr><th scope="row">담당자</th><td>{e.executorName}</td></tr>
        <tr><th scope="row">{e.verdict === "NA" ? "N/A 사유" : "실제결과"}</th><td className="ut-pre">{(e.verdict === "NA" ? e.naReason : e.actualResult) || "–"}</td></tr>
        <tr><th scope="row">증적</th><td>{e.evidences.length ? e.evidences.map((v) => <a key={v.id} className="table-link ut-file" href={`/api/v1/mp/ut/evidences/${v.id}`} target="_blank" rel="noreferrer" onClick={(ev) => onOpenEvidence(ev, v)}>{v.fileName}</a>) : "–"}</td></tr>
        <tr><th scope="row">QC 확인</th><td><ApprovalCell execution={e} step="QC" /></td></tr>
        <tr><th scope="row">PL 확인</th><td><ApprovalCell execution={e} step="PL" /></td></tr>
      </tbody></table>
      <div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>닫기</button></div>
    </div>
  </div>, document.body);
}

/** 차수의 QC 또는 PL 확인 결과 — 승인/반려, 확인자, 반려 사유, 의견. 아직 없으면 대기/해당 없음. */
function ApprovalCell({ execution: e, step }: { execution: Execution; step: "QC" | "PL" }) {
  const a = e.approvals.find((x) => x.step === step);
  if (!a) return <>{step === "QC" && e.verdict === "NA" ? "해당 없음" : e.approvalStatus === `${step}_PENDING` ? "대기" : "–"}</>;
  return <>
    <span className={`badge ${a.decision === "APPROVED" ? "band-green" : "band-red"}`}>{a.decision === "APPROVED" ? "승인" : "반려"}</span>
    <small className="ut-approval">{a.approverName}{a.actedOn ? ` · ${dot(a.actedOn)}` : ""}</small>
    {(a.rejectReason || a.comment) && <small className="ut-approval">{[a.rejectReason, a.comment].filter(Boolean).join(" · ")}</small>}
  </>;
}

/** 수행 상태 표시 — 최근 차수의 테스트 결과(판정). */
function runOf(e: Execution | null): { text: string; tone: string } {
  if (!e) return { text: "미수행", tone: "band-yellow" };
  const tone = e.verdict === "PASS" ? "band-green" : e.verdict === "FAIL" ? "band-red" : e.verdict === "BLOCKED" ? "band-yellow" : "";
  return { text: `수행 ${UT_VERDICT_LABEL[e.verdict]}`, tone };
}

/** 승인 단계 표시 — 최근 차수의 QC/PL 확인 상태를 단어형으로(2026-10-23 사용자 요청: 수행 상태와 함께 별도 영역에 크게). */
function stageOf(e: Execution, step: "QC" | "PL"): { text: string; tone: string } {
  const a = e.approvals.find((x) => x.step === step);
  if (a) return a.decision === "APPROVED" ? { text: `${step} 승인`, tone: "band-green" } : { text: `${step} 반려`, tone: "band-red" };
  if (step === "QC" && e.verdict === "NA") return { text: "QC 해당 없음", tone: "" };
  if (e.approvalStatus === `${step}_PENDING`) return { text: `${step} 대기`, tone: "band-yellow" };
  return { text: `${step} –`, tone: "" };
}

const isImageFile = (name: string) => /\.(png|jpe?g|gif|webp)$/i.test(name);

/** 이미지 증적 미리보기 팝업 — 이미지를 불러오는 시점에 서버가 열람 기록을 남긴다. */
function UtImagePreview({ image, onClose }: { image: { id: string; fileName: string }; onClose: () => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const src = `/api/v1/mp/ut/evidences/${image.id}`;
  return createPortal(<div className="modal-backdrop ut-image-backdrop" role="dialog" aria-modal="true" aria-label={image.fileName} onClick={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
    <div className="modal-card ut-image-modal">
      <div className="ut-image-head"><strong title={image.fileName}>{image.fileName}</strong><a className="table-link" href={src} target="_blank" rel="noreferrer">새 탭에서 열기</a><button type="button" className="button primary" onClick={onClose}>닫기</button></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ut-image-full" src={src} alt={image.fileName} />
    </div>
  </div>, document.body);
}

const VERDICTS: UtVerdict[] = ["PASS", "FAIL", "BLOCKED", "NA"];

/** 단일 선택 체크박스 — 체크박스 모양이지만 1개만 선택된다(2026-10-21·22 사용자 요청: 테스트결과·케이스유형). disabled면 표시용. */
function SingleChecks<T extends string>({ label, items, value, onChange, disabled }: { label: string; items: { value: T; label: string }[]; value: T | null; onChange?: (v: T) => void; disabled?: boolean }) {
  return <div className="ut-verdict-checks" role="radiogroup" aria-label={label}>
    {items.map((x) => <label key={x.value}><input type="checkbox" role="radio" aria-checked={value === x.value} checked={value === x.value} disabled={disabled} onChange={() => onChange?.(x.value)} /> {x.label}</label>)}
  </div>;
}

function VerdictChecks({ value, onChange, disabled }: { value: UtVerdict | null; onChange?: (v: UtVerdict) => void; disabled?: boolean }) {
  return <SingleChecks label="테스트결과" items={VERDICTS.map((v) => ({ value: v, label: UT_VERDICT_LABEL[v] }))} value={value} onChange={onChange} disabled={disabled} />;
}
