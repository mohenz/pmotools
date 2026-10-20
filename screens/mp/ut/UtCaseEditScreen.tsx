"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_CASE_STATUS_LABEL, UT_CASE_TYPE_LABEL, UT_SCENARIO_STATUS_LABEL, UT_VERDICT_LABEL, type UtCaseType } from "@/lib/domain/ut";
import type { getUtCaseEditor, UtTreeNode } from "@/lib/server/mp/ut/grid";
import type { getUtFormOptions } from "@/lib/server/mp/ut/scenarios";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot } from "@/features/mp/ut/format";

type Editor = Awaited<ReturnType<typeof getUtCaseEditor>>;
type Options = Awaited<ReturnType<typeof getUtFormOptions>>;

// UT-021 케이스 편집 — 5장 양식 입력, 작성 검토 체크리스트 표시, 검토요청(설계서 8장).
export function UtCaseEditScreen({ editor, options, leaves, projectCode, userId }: { editor: Editor; options: Options; leaves: UtTreeNode[]; projectCode: string; userId: string }) {
  const router = useRouter();
  const { scenario, case: c } = editor;
  const [wbsItemId, setWbsItemId] = useState(editor.wbsItemId ?? "");
  const [scenarioId, setScenarioId] = useState(scenario?.id ?? "new");
  const [wbsQuery, setWbsQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
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
      if (c) { await utApi(`cases/${c.id}`, json("PATCH", { ...caseData, version: c.version })); setMessage({ tone: "ok", text: "저장했습니다." }); router.refresh(); }
      else { const created = await utApi<{ id: string }>(`scenarios/${sid}/cases`, json("POST", caseData)); router.push(`/mp-ut/cases/${created.id}`); }
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  async function requestReview() {
    if (!scenario) return;
    setPending(true); setMessage(null);
    try { await utApi(`scenarios/${scenario.id}/review`, json("POST")); setMessage({ tone: "ok", text: "검토를 요청했습니다." }); router.refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  const sc = scenario && scenarioId === scenario.id ? scenario : null;
  return <>
    <header className="topbar">
      <div><h1>케이스 편집</h1><p>UT-021 · {c ? <><span className="mono">{c.displayId}</span> <span className={`badge ${STATUS_BAND[c.status]}`}>{UT_CASE_STATUS_LABEL[c.status]}</span></> : "신규 케이스"}{scenario && <> · 시나리오 <span className="mono">{scenario.displayId}</span> <span className={`badge ${STATUS_BAND[scenario.status]}`}>{UT_SCENARIO_STATUS_LABEL[scenario.status]}</span></>}</p></div>
      <div className="topbar-actions">
        <Link className="button secondary" href={`/mp-ut${editor.wbsItemId ? `?wbs=${editor.wbsItemId}` : ""}`}>목록</Link>
        {c && scenario && editor.editable && <Link className="button secondary" href={`/mp-ut/cases/new?scenario=${scenario.id}`}>+ 같은 시나리오에 케이스 추가</Link>}
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
            <select required size={6} value={wbsItemId} onChange={(e) => { setWbsItemId(e.target.value); setScenarioId("new"); router.replace(`/mp-ut/cases/new?wbs=${e.target.value}`); }} aria-label="WBS 선택" className="ut-wbs-select">
              {leafOptions.map((l) => <option key={l.id} value={l.id}>{l.displayId} · {l.code} {l.name}</option>)}
            </select>
          </>}
          {!c && wbsItemId && <label>시나리오<select value={scenarioId} onChange={(e) => { const value = e.target.value; setScenarioId(value); router.replace(value === "new" ? `/mp-ut/cases/new?wbs=${wbsItemId}` : `/mp-ut/cases/new?scenario=${value}`); }}>
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

      {c && c.executions.length > 0 && <section className="panel">
        <div className="panel-head"><h2>수행 이력</h2><span>차수별 판정·증적·확인</span></div>
        <div className="table-wrap"><table className="ut-table"><thead><tr><th>차수</th><th>판정</th><th>테스트수행일</th><th>담당자</th><th>실제결과/N/A 사유</th><th>증적</th><th>확인</th></tr></thead><tbody>
          {c.executions.map((e) => <tr key={e.id}><td>{e.roundNo}</td><td><span className={`badge ${STATUS_BAND[e.verdict]}`}>{UT_VERDICT_LABEL[e.verdict]}</span></td><td>{dot(e.executedOn)}</td><td>{e.executorName}</td><td>{e.actualResult || e.naReason || "–"}</td>
            <td>{e.evidences.map((v) => <a key={v.id} className="table-link ut-file" href={`/api/v1/mp/ut/evidences/${v.id}`} target="_blank" rel="noreferrer">{v.fileName}</a>)}</td>
            <td>{e.approvals.map((a, i) => <small key={i} className="ut-approval">{a.step} {a.decision === "APPROVED" ? "승인" : "반려"} · {a.approverName}{a.comment ? ` · ${a.comment}` : ""}</small>)}</td></tr>)}
        </tbody></table></div>
      </section>}
    </div>
  </>;
}
