"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_CASE_STATUS_LABEL, UT_CASE_TYPE_LABEL, UT_DEFECT_STATUS_LABEL, UT_SCENARIO_STATUS_LABEL, UT_VERDICT_LABEL, UT_VERIFICATION_LABEL, type UtCaseType, type UtVerificationResult } from "@/lib/domain/ut";
import type { getUtCaseEditor, UtTreeNode } from "@/lib/server/mp/ut/grid";
import type { getUtFormOptions } from "@/lib/server/mp/ut/scenarios";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot, today } from "@/features/mp/ut/format";

type Editor = Awaited<ReturnType<typeof getUtCaseEditor>>;
type Options = Awaited<ReturnType<typeof getUtFormOptions>>;

// 단위테스트 정보확인/처리 — 케이스 정보 입력·수정, 검토요청·PL 승인, 판정·증적 등록, QC·PL 확인, 결함 등록·조치·검증, 이력(2026-10-20 화면 2개 체계).
export type UtCaseNavParams = { caseId?: string; scenario?: string; wbs?: string };
export type UtCaseModalControl = { close: () => void; reload: () => void; open: (params: UtCaseNavParams) => void };

export function UtCaseScreen({ editor, options, leaves, projectCode, userId, modal }: { editor: Editor; options: Options; leaves: UtTreeNode[]; projectCode: string; userId: string; modal?: UtCaseModalControl }) {
  const router = useRouter();
  // 모달로 열렸으면 목록을 떠나지 않고 모달 안에서 이동·갱신한다(2026-10-20 사용자 요청).
  const refresh = () => { modal?.reload(); router.refresh(); };
  const goTo = (params: UtCaseNavParams) => {
    if (modal) return modal.open(params);
    if (params.caseId) return router.push(`/mp-ut/cases/${params.caseId}`);
    router.replace(params.scenario ? `/mp-ut/cases/new?scenario=${params.scenario}` : `/mp-ut/cases/new?wbs=${params.wbs ?? ""}`);
  };
  const { scenario, case: c } = editor;
  // 신규 등록에서는 Leaf WBS만 미리 채운다(트리에서 상위 WBS를 고른 상태로 열 수 있음).
  const [wbsItemId, setWbsItemId] = useState(editor.wbsItemId && (editor.scenario || leaves.some((l) => l.id === editor.wbsItemId)) ? editor.wbsItemId : "");
  const [scenarioId, setScenarioId] = useState(scenario?.id ?? "new");
  const [wbsQuery, setWbsQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [openDefect, setOpenDefect] = useState<{ id: string; kind: "fix" | "verify" } | null>(null);
  const latest = c?.executions[0] ?? null;

  async function act(fn: () => Promise<unknown>, done: string) {
    setPending(true); setMessage(null);
    try { await fn(); setMessage({ tone: "ok", text: done }); setOpenDefect(null); refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }
  const formValues = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const f = new FormData(event.currentTarget); return { f, v: (n: string) => ((f.get(n) as string) ?? "").trim() }; };
  const readOnly = !editor.editable;
  const isNewScenario = scenarioId === "new";
  const leafOptions = useMemo(() => { const k = wbsQuery.trim().toLowerCase(); return (k ? leaves.filter((l) => `${l.displayId} ${l.code} ${l.name}`.toLowerCase().includes(k)) : leaves).slice(0, 300); }, [wbsQuery, leaves]);
  const members = options.members;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(null);
    const f = new FormData(event.currentTarget);
    const v = (n: string) => ((f.get(n) as string) ?? "").trim();
    const scenarioData = { name: v("scenarioName"), groupId: v("groupId"), priority: v("priority"), plUserId: v("plUserId") || null, programId: v("programId") || null, requirementId: v("requirementId") || null };
    const caseData = { caseType: v("caseType"), name: v("caseName"), precondition: v("precondition"), steps: v("steps"), inputData: v("inputData"), expectedResult: v("expectedResult"), priority: v("priority"), executorId: v("executorId") || null, qcUserId: v("qcUserId") || null, plannedDate: v("plannedDate") || null };
    try {
      let sid = scenarioId;
      if (isNewScenario) sid = (await utApi<{ id: string }>("scenarios", json("POST", { wbsItemId, ...scenarioData }))).id;
      else if (scenario && sid === scenario.id) await utApi(`scenarios/${sid}`, json("PATCH", { ...scenarioData, version: scenario.version }));
      if (c) { await utApi(`cases/${c.id}`, json("PATCH", { ...caseData, version: c.version })); setMessage({ tone: "ok", text: "저장했습니다." }); refresh(); }
      else { const created = await utApi<{ id: string }>(`scenarios/${sid}/cases`, json("POST", caseData)); router.refresh(); goTo({ caseId: created.id }); }
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  async function requestReview() {
    if (!scenario) return;
    setPending(true); setMessage(null);
    try { await utApi(`scenarios/${scenario.id}/review`, json("POST")); setMessage({ tone: "ok", text: "검토를 요청했습니다." }); refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  const sc = scenario && scenarioId === scenario.id ? scenario : null;
  return <>
    <header className="topbar">
      <div><h1>테스트 케이스 정보</h1><p>{c ? <><span className="mono">{c.displayId}</span> <span className={`badge ${STATUS_BAND[c.status]}`}>{UT_CASE_STATUS_LABEL[c.status]}</span></> : "신규 케이스"}{scenario && <> · 시나리오 <span className="mono">{scenario.displayId}</span> <span className={`badge ${STATUS_BAND[scenario.status]}`}>{UT_SCENARIO_STATUS_LABEL[scenario.status]}</span></>}</p></div>
      <div className="topbar-actions">
        {c && scenario && editor.editable && <button type="button" className="button secondary" onClick={() => goTo({ scenario: scenario.id })}>+ 같은 시나리오에 케이스 추가</button>}
        {modal ? <button type="button" className="button secondary" onClick={modal.close}>닫기</button> : <Link className="button secondary" href={`/mp-ut${editor.wbsItemId ? `?wbs=${editor.wbsItemId}` : ""}`}>목록</Link>}
      </div>
    </header>
    <div className="content ut-edit">
      {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
      {scenario?.status === "REJECTED" && scenario.rejectReason && <p className="action-message">반려 사유: {scenario.rejectReason}</p>}
      {readOnly && <p className="ut-hint">작성중·반려 상태의 시나리오만 작성자 또는 PM/PMO가 수정할 수 있습니다.</p>}
      <form className="panel form-panel" onSubmit={save}>
        <fieldset disabled={readOnly || pending} className="ut-fieldset">
          <h2 className="ut-section">식별</h2>
          <div className="form-grid triple">
            <label>프로젝트 코드<input value={projectCode} readOnly /></label>
            <label>시나리오 ID<input value={sc?.displayId ?? "저장 시 자동 채번"} readOnly /></label>
            <label>케이스 ID<input value={c?.displayId ?? "저장 시 자동 채번"} readOnly /></label>
          </div>
          {scenario ? <label>WBS ID<input value={`${scenario.wbsDisplayId} ${scenario.wbsName}`} readOnly /></label> : <>
            <label>WBS ID (Leaf)<input type="search" placeholder="WBS 코드·명 검색" value={wbsQuery} onChange={(e) => setWbsQuery(e.target.value)} /></label>
            <select required size={6} value={wbsItemId} onChange={(e) => { setWbsItemId(e.target.value); setScenarioId("new"); goTo({ wbs: e.target.value }); }} aria-label="WBS 선택" className="ut-wbs-select">
              {leafOptions.map((l) => <option key={l.id} value={l.id}>{l.displayId} · {l.code} {l.name}</option>)}
            </select>
          </>}
          {!c && wbsItemId && <label>시나리오<select value={scenarioId} onChange={(e) => { const value = e.target.value; setScenarioId(value); goTo(value === "new" ? { wbs: wbsItemId } : { scenario: value }); }}>
            {editor.wbsScenarios.filter((s) => s.status === "DRAFT" || s.status === "REJECTED").map((s) => <option key={s.id} value={s.id}>{s.displayId} {s.name}</option>)}
            <option value="new">+ 새 시나리오</option>
          </select></label>}

          <h2 className="ut-section">대상</h2>
          <div className="form-grid">
            <label>시나리오명<input name="scenarioName" required maxLength={200} defaultValue={sc?.name ?? ""} key={`sn-${scenarioId}`} /></label>
            <label>케이스명<input name="caseName" required maxLength={200} defaultValue={c?.name ?? ""} placeholder="검증 규칙 1개를 한 줄로" /></label>
          </div>
          <div className="form-grid">
            <label>프로그램 ID · 화면 ID(선택)<select name="programId" defaultValue={sc?.programId ?? ""} key={`pg-${scenarioId}`}><option value="">미지정</option>{options.programs.map((p) => <option key={p.id} value={p.id}>{p.programCode} {p.name}{p.screenId ? ` (${p.screenId})` : ""}</option>)}</select></label>
            <label>요구사항 ID(선택)<select name="requirementId" defaultValue={sc?.requirementId ?? ""} key={`rq-${scenarioId}`}><option value="">미지정</option>{options.requirements.map((r) => <option key={r.id} value={r.id}>{r.displayId} {r.title}</option>)}</select></label>
          </div>

          <h2 className="ut-section">분류</h2>
          <div className="form-grid triple">
            <label>케이스 유형<select name="caseType" defaultValue={c?.caseType ?? "NORMAL"}>{(Object.keys(UT_CASE_TYPE_LABEL) as UtCaseType[]).map((t) => <option key={t} value={t}>{UT_CASE_TYPE_LABEL[t]}</option>)}</select></label>
            <label>우선순위<select name="priority" defaultValue={c?.priority ?? sc?.priority ?? "M"} key={`pr-${scenarioId}`}><option value="H">H — 결제·주문·권한·저장·정산</option><option value="M">M — 조회·변경</option><option value="L">L — 표시·문구</option></select></label>
            <label>업무단위<select name="groupId" required defaultValue={sc?.groupId ?? ""} key={`gr-${scenarioId}`}><option value="" disabled>선택</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
          </div>

          <h2 className="ut-section">내용</h2>
          <div className="form-grid">
            <label>사전조건<textarea name="precondition" rows={2} defaultValue={c?.precondition ?? ""} /></label>
            <label>입력데이터<textarea name="inputData" rows={2} defaultValue={c?.inputData ?? ""} /></label>
          </div>
          <label>테스트스텝<textarea name="steps" rows={4} defaultValue={c?.steps ?? ""} placeholder={"1. …\n2. …"} /></label>
          <label>예상결과<input name="expectedResult" maxLength={200} defaultValue={c?.expectedResult ?? ""} placeholder="1문장, 확인 가능한 결과" /></label>

          <h2 className="ut-section">계획</h2>
          <div className="form-grid">
            <label>수행 담당자<select name="executorId" defaultValue={c?.executorId ?? userId}><option value="">미지정</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>예정일<input type="date" name="plannedDate" defaultValue={c?.plannedDate ?? ""} /></label>
          </div>
          <div className="form-grid">
            <label>QC 확인자<select name="qcUserId" defaultValue={c?.qcUserId ?? ""}><option value="">미지정</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label>PL 확인자<select name="plUserId" defaultValue={sc?.plUserId ?? ""} key={`pl-${scenarioId}`}><option value="">미지정</option>{members.filter((m) => m.id !== userId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          </div>
          <div className="form-actions"><button className="button primary" disabled={pending || (!scenario && !wbsItemId)}>{pending ? "저장 중…" : "저장"}</button></div>
        </fieldset>
      </form>

      {scenario && <section className="panel">
        <div className="panel-head"><h2>작성 검토 체크리스트</h2><span>시나리오 {scenario.displayId} · 케이스 {scenario.caseCount}건 · PL 검토 시 수기 확인</span></div>
        <ul className="ut-checklist">{scenario.checklist.map((i) => <li key={i.key} className={i.ok ? "ok" : "ng"}>{i.ok ? "✔" : "✖"} {i.message}</li>)}</ul>
        {scenario.missing.length > 0 && <p className="ut-missing">필수 항목 누락: {scenario.missing.map((m) => `${m.displayId}(${m.fields.join(", ")})`).join(" / ")}</p>}
        {editor.canRequestReview && <div className="form-actions"><button className="button primary" disabled={pending} onClick={requestReview}>검토요청</button></div>}
      </section>}


      {editor.canDecideReview && scenario && <section className="panel">
        <div className="panel-head"><h2>PL 검토</h2><span>시나리오 {scenario.displayId} · 작성자 {editor.writerName}</span></div>
        <form className="ut-decide" onSubmit={(e) => { const { v } = formValues(e); const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "APPROVED"; void act(() => utApi(`scenarios/${scenario.id}/decision`, json("POST", { decision, reason: v("reason") })), decision === "APPROVED" ? "승인했습니다." : "반려했습니다."); }}>
          <label>반려 사유(반려 시 필수)<input name="reason" maxLength={1000} /></label>
          <button className="button primary" name="decision" value="APPROVED" disabled={pending}>승인</button>
          <button className="button secondary" name="decision" value="REJECTED" disabled={pending}>반려</button>
        </form>
      </section>}

      {editor.canExecute && c && <section className="panel">
        <div className="panel-head"><h2>테스트 수행 결과 등록</h2><span>{latest ? `${latest.roundNo + 1}차` : "1차"} · 증적 필수(Pass·Fail)</span></div>
        <form className="ut-exec-form" onSubmit={(e) => { e.preventDefault(); const body = new FormData(e.currentTarget); void act(() => utApi(`cases/${c.id}/executions`, { method: "POST", body }), "수행 결과를 등록했습니다."); }}>
          <div className="form-grid triple">
            <label>테스트 결과<select name="verdict" defaultValue="PASS"><option value="PASS">PASS</option><option value="FAIL">FAIL</option><option value="BLOCKED">BLOCKED</option><option value="NA">N/A</option></select></label>
            <label>테스트 수행일<input type="date" name="executedOn" defaultValue={today()} /></label>
            <label>수행 환경<select name="envCodeId" defaultValue=""><option value="">미지정</option>{options.codes.envs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          </div>
          <label>실제결과(FAIL 필수)<textarea name="actualResult" rows={2} /></label>
          <label>N/A 사유(N/A 필수)<input name="naReason" maxLength={1000} /></label>
          <label>증적 파일<input type="file" name="evidence" multiple /></label>
          <div className="form-actions"><button className="button primary" disabled={pending}>등록</button></div>
        </form>
      </section>}

      {(editor.canQc || editor.canPl) && latest && <section className="panel">
        <div className="panel-head"><h2>{editor.canQc ? "QC 확인" : "PL 확인"}</h2><span>{latest.roundNo}차 {UT_VERDICT_LABEL[latest.verdict]} · 증적을 모두 열람하면 승인할 수 있습니다</span></div>
        <dl className="ut-dl">
          <div><dt>예상결과</dt><dd>{c?.expectedResult || "–"}</dd></div>
          <div><dt>{latest.verdict === "NA" ? "N/A 사유" : "실제결과"}</dt><dd>{(latest.verdict === "NA" ? latest.naReason : latest.actualResult) || "–"}</dd></div>
          <div><dt>증적</dt><dd>{latest.evidences.length ? latest.evidences.map((x) => <a key={x.id} className={`table-link ut-file${x.viewed || viewed.has(x.id) ? " viewed" : ""}`} href={`/api/v1/mp/ut/evidences/${x.id}`} target="_blank" rel="noreferrer" onClick={() => setViewed((s0) => new Set(s0).add(x.id))}>{x.viewed || viewed.has(x.id) ? "✔ " : ""}{x.fileName}</a>) : "–"}</dd></div>
        </dl>
        <form className="ut-decide" onSubmit={(e) => { const { v } = formValues(e); const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "APPROVED"; void act(() => utApi(`executions/${latest.id}/approval`, json("POST", { step: editor.canQc ? "QC" : "PL", decision, rejectReasonCodeId: v("rejectReasonCodeId") || null, comment: v("comment") })), decision === "APPROVED" ? "승인했습니다." : "반려했습니다."); }}>
          <label>반려 사유<select name="rejectReasonCodeId" defaultValue=""><option value="">(반려 시 선택)</option>{options.codes.rejectReasons.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label>의견<input name="comment" maxLength={2000} /></label>
          <button className="button primary" name="decision" value="APPROVED" disabled={pending || !(latest.verdict === "NA" || (latest.evidences.length > 0 && latest.evidences.every((x) => x.viewed || viewed.has(x.id))))}>승인</button>
          <button className="button secondary" name="decision" value="REJECTED" disabled={pending}>반려</button>
        </form>
      </section>}

      {c && (c.defects.length > 0 || editor.canRegisterDefect) && <section className="panel">
        <div className="panel-head"><h2>결함</h2><span>결함 ID · 조치일 · 조치자 · 검증결과 · 검증일자 · 검증자</span></div>
        {c.defects.length > 0 && <div className="table-wrap"><table className="ut-table">
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
              <form className="ut-decide" onSubmit={(e) => { const { v } = formValues(e); void act(() => utApi(`defects/${d.id}/${openDefect.kind}`, json("POST", openDefect.kind === "fix" ? { fixedAt: v("date"), note: v("note"), version: d.version } : { result: v("result"), verifiedAt: v("date"), note: v("note"), version: d.version })), openDefect.kind === "fix" ? "조치를 등록했습니다." : "검증을 등록했습니다."); }}>
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
        {editor.canRegisterDefect && latest && <form className="ut-exec-form" onSubmit={(e) => { const { v } = formValues(e); void act(() => utApi(`executions/${latest.id}/defects`, json("POST", { description: v("description"), severity: v("severity"), defectTypeCodeId: v("defectTypeCodeId") || null, causeGroupId: v("causeGroupId") || null, vendorGroupId: v("vendorGroupId") || null, assigneeId: v("assigneeId") || null })), "결함을 등록했습니다."); }}>
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
      </section>}

      {c && c.executions.length > 0 && <section className="panel">
        <div className="panel-head"><h2>수행 이력</h2><span>차수별 테스트 결과·증적·QC/PL 확인</span></div>
        <div className="table-wrap"><table className="ut-table"><thead><tr><th>차수</th><th>판정</th><th>테스트수행일</th><th>담당자</th><th>실제결과/N/A 사유</th><th>증적</th><th>확인</th></tr></thead><tbody>
          {c.executions.map((e) => <tr key={e.id}><td>{e.roundNo}</td><td><span className={`badge ${STATUS_BAND[e.verdict]}`}>{UT_VERDICT_LABEL[e.verdict]}</span></td><td>{dot(e.executedOn)}</td><td>{e.executorName}</td><td>{e.actualResult || e.naReason || "–"}</td>
            <td>{e.evidences.map((v) => <a key={v.id} className="table-link ut-file" href={`/api/v1/mp/ut/evidences/${v.id}`} target="_blank" rel="noreferrer">{v.fileName}</a>)}</td>
            <td>{e.approvals.map((a, i) => <small key={i} className="ut-approval">{a.step} {a.decision === "APPROVED" ? "승인" : "반려"} · {a.approverName}{a.comment ? ` · ${a.comment}` : ""}</small>)}</td></tr>)}
        </tbody></table></div>
      </section>}
    </div>
  </>;
}
