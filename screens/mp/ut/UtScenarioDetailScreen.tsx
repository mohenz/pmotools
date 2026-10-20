"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_CASE_STATUS_LABEL, UT_CASE_TYPE_LABEL, UT_SCENARIO_STATUS_LABEL, UT_VERDICT_LABEL, canExecuteCase, type UtCaseType } from "@/lib/domain/ut";
import type { getUtFormOptions, getUtScenarioDetail } from "@/lib/server/mp/ut/scenarios";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot, today } from "@/features/mp/ut/format";

type Detail = Awaited<ReturnType<typeof getUtScenarioDetail>>;
type Case = Detail["cases"][number];
type Options = Awaited<ReturnType<typeof getUtFormOptions>>;

// UT-020/021/023/030 — 시나리오 상세: 케이스 작성·검토요청·PL 승인, 수행 등록(증적 첨부), Fail 결함 등록.
export function UtScenarioDetailScreen({ detail, options, userId }: { detail: Detail; options: Options; userId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [execFor, setExecFor] = useState<string | null>(null);
  const [defectFor, setDefectFor] = useState<string | null>(null);
  const { permissions: can } = detail;

  async function run(fn: () => Promise<unknown>, done: string) {
    setPending(true); setMessage(null);
    try { await fn(); setMessage({ tone: "ok", text: done }); setEditing(null); setExecFor(null); setDefectFor(null); router.refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  function saveCase(event: FormEvent<HTMLFormElement>, c: Case | null) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const v = (n: string) => ((f.get(n) as string) ?? "").trim();
    const data = { caseType: v("caseType"), name: v("name"), precondition: v("precondition"), steps: v("steps"), inputData: v("inputData"), expectedResult: v("expectedResult"), priority: v("priority"), executorId: v("executorId") || null, qcUserId: v("qcUserId") || null, plannedDate: v("plannedDate") || null };
    void run(() => c ? utApi(`cases/${c.id}`, json("PATCH", { ...data, version: c.version })) : utApi(`scenarios/${detail.id}/cases`, json("POST", data)), c ? "케이스를 수정했습니다." : "케이스를 추가했습니다.");
  }

  function submitExecution(event: FormEvent<HTMLFormElement>, c: Case) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => utApi(`cases/${c.id}/executions`, { method: "POST", body: form }), "수행 결과를 등록했습니다.");
  }

  function submitDefect(event: FormEvent<HTMLFormElement>, executionId: string) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const v = (n: string) => ((f.get(n) as string) ?? "").trim() || null;
    void run(() => utApi(`executions/${executionId}/defects`, json("POST", { description: v("description"), severity: v("severity"), defectTypeCodeId: v("defectTypeCodeId"), causeGroupId: v("causeGroupId"), vendorGroupId: v("vendorGroupId"), assigneeId: v("assigneeId") })), "결함을 등록했습니다.");
  }

  const members = options.members;
  const caseForm = (c: Case | null) => <form className="ut-case-form" onSubmit={(e) => saveCase(e, c)}>
    <div className="form-grid triple">
      <label>케이스 유형<select name="caseType" defaultValue={c?.caseType ?? "NORMAL"}>{(Object.keys(UT_CASE_TYPE_LABEL) as UtCaseType[]).map((t) => <option key={t} value={t}>{UT_CASE_TYPE_LABEL[t]}</option>)}</select></label>
      <label>우선순위<select name="priority" defaultValue={c?.priority ?? detail.priority}><option>H</option><option>M</option><option>L</option></select></label>
      <label>예정일<input type="date" name="plannedDate" defaultValue={c?.plannedDate ?? ""} /></label>
    </div>
    <label>케이스명<input name="name" required maxLength={200} defaultValue={c?.name ?? ""} placeholder="검증 규칙 1개를 한 줄로 (예: 주문수량 0 입력 차단)" /></label>
    <div className="form-grid">
      <label>사전조건<textarea name="precondition" rows={2} defaultValue={c?.precondition ?? ""} /></label>
      <label>입력데이터<textarea name="inputData" rows={2} defaultValue={c?.inputData ?? ""} /></label>
    </div>
    <label>테스트스텝<textarea name="steps" rows={3} defaultValue={c?.steps ?? ""} placeholder={"1. …\n2. …"} /></label>
    <label>예상결과<input name="expectedResult" maxLength={200} defaultValue={c?.expectedResult ?? ""} placeholder="1문장, 확인 가능한 결과" /></label>
    <div className="form-grid">
      <label>수행 담당자<select name="executorId" defaultValue={c?.executor?.id ?? ""}><option value="">미지정</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>QC 확인자<select name="qcUserId" defaultValue={c?.qc?.id ?? ""}><option value="">미지정</option>{members.filter((m) => m.id !== detail.pl?.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    </div>
    <div className="form-actions"><button className="button primary" disabled={pending}>{c ? "저장" : "추가"}</button><button type="button" className="button secondary" onClick={() => setEditing(null)}>취소</button></div>
  </form>;

  return <>
    <header className="topbar">
      <div>
        <h1><span className="mono">{detail.displayId}</span> {detail.name}</h1>
        <p><span className={`badge ${STATUS_BAND[detail.status]}`}>{UT_SCENARIO_STATUS_LABEL[detail.status]}</span> · WBS <span className="mono">{detail.wbs.displayId}</span> {detail.wbs.name} · 업무단위 {detail.group.label} · 작성 {detail.writer.name} · PL {detail.pl?.name ?? "미지정"}</p>
      </div>
      <div className="topbar-actions">
        <Link className="button secondary" href="/mp-ut">목록</Link>
        {can.canRequestReview && <button className="button primary" disabled={pending} onClick={() => run(() => utApi(`scenarios/${detail.id}/review`, json("POST")), "검토를 요청했습니다.")}>검토요청</button>}
      </div>
    </header>
    <div className="content ut-detail">
      {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
      {detail.status === "REJECTED" && detail.rejectReason && <p className="action-message">반려 사유: {detail.rejectReason}</p>}

      {can.canDecide && <section className="panel ut-decision">
        <div className="panel-head"><h2>PL 검토</h2><span>케이스와 체크리스트를 확인한 뒤 승인 또는 반려</span></div>
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const decision = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "APPROVED"; void run(() => utApi(`scenarios/${detail.id}/decision`, json("POST", { decision, reason: f.get("reason") })), decision === "APPROVED" ? "승인했습니다." : "반려했습니다."); }}>
          <label>반려 사유(반려 시 필수)<input name="reason" maxLength={1000} /></label>
          <div className="form-actions"><button className="button primary" name="decision" value="APPROVED" disabled={pending}>승인</button><button className="button secondary" name="decision" value="REJECTED" disabled={pending}>반려</button></div>
        </form>
      </section>}

      {can.isManager && <section className="panel compact ut-pl">
        <form className="filters inline-filter" onSubmit={(e) => { e.preventDefault(); const plUserId = new FormData(e.currentTarget).get("plUserId"); void run(() => utApi(`scenarios/${detail.id}/pl`, json("PUT", { plUserId })), "PL을 변경했습니다."); }}>
          <label>PL 변경(PM/PMO)<select name="plUserId" defaultValue={detail.pl?.id ?? ""} required><option value="" disabled>선택</option>{members.filter((m) => m.id !== detail.writer.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <button className="button secondary" disabled={pending}>변경</button>
        </form>
      </section>}

      <section className="ut-side">
        <div className="panel">
          <div className="panel-head"><h2>PL 검토 체크리스트</h2><span>수기 확인(차단 없음)</span></div>
          <ul className="ut-checklist">{detail.checklist.map((i) => <li key={i.key} className={i.ok ? "ok" : "ng"}>{i.ok ? "✔" : "✖"} {i.message}</li>)}</ul>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>UT완료 조건 현황</h2><span>이 시나리오 기준 · 조회용</span></div>
          <ul className="ut-checklist">
            <li className={detail.conditions.conditions.c1Approved ? "ok" : "ng"}>① 케이스 PL 승인 {detail.conditions.approvedCount}/{detail.conditions.activeCount}</li>
            <li className={detail.conditions.conditions.c2AllExecuted ? "ok" : "ng"}>② 수행 {detail.conditions.executedCount}/{detail.conditions.targetCount}</li>
            <li className={detail.conditions.conditions.c3AllPassedNoOpenDefect ? "ok" : "ng"}>③ Pass {detail.conditions.passedCount}/{detail.conditions.targetCount} · Open 결함(Critical·Major) {detail.conditions.blockingOpenDefectCount}</li>
            <li className={detail.conditions.conditions.c4EvidenceAndConfirmed ? "ok" : "ng"}>④ 증적 {detail.conditions.evidencedCount} · PL확인완료 {detail.conditions.confirmedCount}/{detail.conditions.passedCount}</li>
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>케이스</h2><span>{detail.cases.filter((c) => c.isActive).length}건{can.canEdit ? " · 작성중/반려 상태에서만 수정" : ""}</span>{can.canEdit && editing !== "new" && <button className="button secondary" onClick={() => setEditing("new")}>+ 케이스 추가</button>}</div>
        {editing === "new" && caseForm(null)}
        <div className="table-wrap">
          <table className="ut-table">
            <thead><tr><th>케이스 ID</th><th>유형</th><th>케이스명</th><th>우선</th><th>수행자</th><th>QC</th><th>예정일</th><th>상태</th><th>최근 판정</th><th /></tr></thead>
            <tbody>{detail.cases.map((c) => {
              const latest = c.executions[0];
              const canRun = c.isActive && c.executor?.id === userId && canExecuteCase(c.status) && detail.status === "APPROVED";
              const failNoDefect = latest?.verdict === "FAIL" && c.executor?.id === userId || (latest?.verdict === "FAIL" && (c.qc?.id === userId || detail.pl?.id === userId || can.isManager));
              return [
                <tr key={c.id} className={c.isActive ? undefined : "ut-inactive"}>
                  <td className="mono"><button type="button" className="table-link portfolio-link" onClick={() => setOpen(open === c.id ? null : c.id)}>{c.displayId}</button></td>
                  <td>{UT_CASE_TYPE_LABEL[c.caseType]}</td>
                  <td>{c.name}{c.missing.length > 0 && <small className="ut-missing">누락: {c.missing.join(", ")}</small>}</td>
                  <td>{c.priority}</td>
                  <td>{c.executor?.name ?? "–"}</td>
                  <td>{c.qc?.name ?? "–"}</td>
                  <td>{dot(c.plannedDate)}</td>
                  <td><span className={`badge ${STATUS_BAND[c.status]}`}>{c.isActive ? UT_CASE_STATUS_LABEL[c.status] : "비활성"}</span></td>
                  <td>{latest ? <span className={`badge ${STATUS_BAND[latest.verdict]}`}>{latest.roundNo}차 {UT_VERDICT_LABEL[latest.verdict]}</span> : "–"}</td>
                  <td className="ut-actions">
                    {can.canEdit && <button className="button secondary" onClick={() => setEditing(c.id)}>수정</button>}
                    {can.canEdit && <button className="button secondary" onClick={() => run(() => utApi(`cases/${c.id}/active`, json("PUT", { isActive: !c.isActive })), c.isActive ? "비활성화했습니다." : "활성화했습니다.")}>{c.isActive ? "비활성" : "활성"}</button>}
                    {canRun && <button className="button primary" onClick={() => setExecFor(execFor === c.id ? null : c.id)}>수행 등록</button>}
                    {failNoDefect && <button className="button secondary" onClick={() => setDefectFor(defectFor === latest!.id ? null : latest!.id)}>결함 등록</button>}
                  </td>
                </tr>,
                editing === c.id && <tr key={`${c.id}-edit`}><td colSpan={10}>{caseForm(c)}</td></tr>,
                execFor === c.id && <tr key={`${c.id}-exec`}><td colSpan={10}>
                  <form className="ut-exec-form" onSubmit={(e) => submitExecution(e, c)}>
                    <div className="form-grid triple">
                      <label>판정<select name="verdict" defaultValue="PASS"><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="BLOCKED">Blocked</option><option value="NA">N/A</option></select></label>
                      <label>테스트수행일<input type="date" name="executedOn" defaultValue={today()} /></label>
                      <label>수행 환경<select name="envCodeId" defaultValue=""><option value="">미지정</option>{options.codes.envs.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
                    </div>
                    <label>실제결과(Fail 필수)<textarea name="actualResult" rows={2} /></label>
                    <label>N/A 사유(N/A 필수)<input name="naReason" maxLength={1000} /></label>
                    <label>증적(Pass·Fail 필수, 여러 개 가능)<input type="file" name="evidence" multiple /></label>
                    <div className="form-actions"><button className="button primary" disabled={pending}>{pending ? "등록 중…" : "등록"}</button><button type="button" className="button secondary" onClick={() => setExecFor(null)}>취소</button></div>
                  </form>
                </td></tr>,
                latest && defectFor === latest.id && <tr key={`${c.id}-defect`}><td colSpan={10}>
                  <form className="ut-exec-form" onSubmit={(e) => submitDefect(e, latest.id)}>
                    <label>결함내용<textarea name="description" rows={3} required defaultValue={latest.actualResult} /></label>
                    <div className="form-grid triple">
                      <label>심각도<select name="severity" defaultValue="MAJOR"><option value="CRITICAL">Critical</option><option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="TRIVIAL">Trivial</option></select></label>
                      <label>결함 유형<select name="defectTypeCodeId" defaultValue=""><option value="">미지정</option>{options.codes.defectTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
                      <label>조치 담당자<select name="assigneeId" defaultValue={c.executor?.id ?? ""}><option value="">수행 담당자</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                    </div>
                    <div className="form-grid">
                      <label>원인 업무단위<select name="causeGroupId" defaultValue={detail.group.id}><option value="">미지정</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
                      <label>협력사{options.companies.length ? "(필수)" : ""}<select name="vendorGroupId" defaultValue="" required={options.companies.length > 0}><option value="">미지정</option>{options.companies.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
                    </div>
                    <div className="form-actions"><button className="button primary" disabled={pending}>결함 등록</button><button type="button" className="button secondary" onClick={() => setDefectFor(null)}>취소</button></div>
                  </form>
                </td></tr>,
                open === c.id && <tr key={`${c.id}-open`} className="ut-expand"><td colSpan={10}>
                  <dl className="ut-dl"><div><dt>사전조건</dt><dd>{c.precondition || "–"}</dd></div><div><dt>입력데이터</dt><dd>{c.inputData || "–"}</dd></div><div><dt>테스트스텝</dt><dd className="ut-pre">{c.steps || "–"}</dd></div><div><dt>예상결과</dt><dd>{c.expectedResult || "–"}</dd></div></dl>
                  {c.executions.length > 0 && <table className="ut-subtable"><thead><tr><th>차수</th><th>판정</th><th>수행일</th><th>수행자</th><th>실제결과/N/A 사유</th><th>증적</th><th>확인 이력</th></tr></thead><tbody>
                    {c.executions.map((e) => <tr key={e.id}>
                      <td>{e.roundNo}</td><td><span className={`badge ${STATUS_BAND[e.verdict]}`}>{UT_VERDICT_LABEL[e.verdict]}</span></td><td>{dot(e.executedOn)}</td><td>{e.executorName}</td>
                      <td>{e.actualResult || e.naReason || "–"}</td>
                      <td>{e.evidences.map((v) => <a key={v.id} className="table-link ut-file" href={`/api/v1/mp/ut/evidences/${v.id}`} target="_blank" rel="noreferrer">{v.fileName}</a>)}</td>
                      <td>{e.approvals.map((a, i) => <small key={i} className="ut-approval">{a.step} {a.decision === "APPROVED" ? "승인" : "반려"} · {a.approverName}{a.comment ? ` · ${a.comment}` : ""}</small>)}{!e.approvals.length && (e.approvalStatus ? "대기" : "–")}</td>
                    </tr>)}
                  </tbody></table>}
                  {c.defects.length > 0 && <p className="ut-hint">결함: {c.defects.map((d) => `${d.displayId}(${d.status})`).join(", ")} — <Link className="table-link" href={`/mp-ut/runs?scenarioId=${detail.id}`}>수행·결함 관리</Link></p>}
                </td></tr>,
              ];
            })}</tbody>
          </table>
          {!detail.cases.length && <p className="empty">케이스가 없습니다. 정상 1건 이상, 예외+경계 2건 이상을 권장합니다.</p>}
        </div>
      </section>
    </div>
  </>;
}
