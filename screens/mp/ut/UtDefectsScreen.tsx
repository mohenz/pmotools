"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_DEFECT_STATUS_LABEL, UT_VERDICT_LABEL, UT_VERIFICATION_LABEL, type UtDefectStatus, type UtVerdict, type UtVerificationResult } from "@/lib/domain/ut";
import type { UtRunRow } from "@/lib/server/mp/ut/defects";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot, today } from "@/features/mp/ut/format";
import { UtPagination, type UtPageSize } from "@/features/mp/ut/UtPagination";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";
import type { UtTreeNode } from "@/lib/server/mp/ut/grid";
import type { getUtFormOptions } from "@/lib/server/mp/ut/scenarios";

// UT-040 결함 관리 — 설계서 5.1 양식 13개 열 목록·엑셀 출력, 결함 등록(Fail 건), 조치·검증 등록, 이력. 좌측 WBS 트리(8장).
export function UtDefectsScreen({ tree, rows, filters, paging, options }: { tree: UtTreeNode[]; rows: UtRunRow[]; filters: Record<string, string>; paging: { pageSize: UtPageSize; page: number; total: number; totalPages: number }; options: Awaited<ReturnType<typeof getUtFormOptions>> }) {
  const router = useRouter();
  const [action, setAction] = useState<{ row: UtRunRow; kind: "fix" | "verify" } | null>(null);
  const [register, setRegister] = useState<UtRunRow | null>(null);
  const [history, setHistory] = useState<{ id: string; items: { actionType: string; actorName: string; actedOn: string | null; verificationResult: string | null; note: string }[] } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const f = new FormData(event.currentTarget);
    const { row, kind } = action;
    const body = kind === "fix" ? { fixedAt: f.get("date"), note: f.get("note") ?? "", version: row.version } : { result: f.get("result"), verifiedAt: f.get("date"), note: f.get("note") ?? "", version: row.version };
    setPending(true); setMessage(null);
    utApi(`defects/${row.defectId}/${kind}`, json("POST", body))
      .then(() => { setMessage({ tone: "ok", text: kind === "fix" ? "조치를 등록했습니다." : "검증을 등록했습니다." }); setAction(null); router.refresh(); })
      .catch((e: Error) => setMessage({ tone: "error", text: e.message }))
      .finally(() => setPending(false));
  }

  async function showHistory(defectId: string) {
    try { setHistory({ id: defectId, items: await utApi(`defects/${defectId}/actions`) }); } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
  }

  return <>
    <header className="topbar">
      <div><h1>결함 관리</h1><p>UT-040 · 테스트 수행·결함 관리 양식(13개 열) · 총 {paging.total}행</p></div>
      <div className="topbar-actions"><a className="button secondary" href={`/api/v1/mp/ut/runs?${query}${query ? "&" : ""}format=xlsx`}>엑셀 출력</a></div>
    </header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
      <form className="filters requirement-filter-panel" method="get">
        {filters.wbs && <input type="hidden" name="wbs" value={filters.wbs} />}
        {filters.scenarioId && <input type="hidden" name="scenarioId" value={filters.scenarioId} />}
        {paging.pageSize !== 20 && <input type="hidden" name="pageSize" value={String(paging.pageSize)} />}
        <input name="q" defaultValue={filters.q ?? ""} placeholder="케이스ID·케이스명·결함내용 검색" aria-label="검색어" />
        <select name="defect" defaultValue={filters.defect ?? ""} aria-label="결함 범위"><option value="">전체 수행</option><option value="any">결함 있는 건</option><option value="open">미검증 결함</option></select>
        <button className="button secondary" type="submit">조회</button>
        
      </form>
      <section className="panel compact">
        {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
        <div className="table-wrap">
          <table className="ut-table ut-runs">
            <thead><tr><th>업무단위</th><th>테스트케이스ID</th><th>테스트케이스명</th><th>테스트스텝</th><th>결함내용</th><th>담당자</th><th>테스트수행일</th><th>화면ID</th><th>조치일</th><th>조치자</th><th>검증결과</th><th>검증일자</th><th>검증자</th><th>판정</th><th>결함</th><th /></tr></thead>
            <tbody>{rows.map((r) => <tr key={`${r.executionId}-${r.defectId ?? "none"}`}>
              <td>{r.unit}</td>
              <td className="mono"><Link className="table-link" href={`/mp-ut/${r.scenarioId}`}>{r.caseDisplayId}</Link></td>
              <td>{r.caseName}</td>
              <td className="ut-pre ut-steps">{r.steps}</td>
              <td className="ut-pre">{r.description}</td>
              <td>{r.executorName}</td>
              <td>{dot(r.executedOn)}</td>
              <td>{r.screenId || "–"}</td>
              <td>{dot(r.fixedAt)}</td>
              <td>{r.fixerName ?? "–"}</td>
              <td>{r.verificationResult ? <span className={`badge ${r.verificationResult === "PASS" ? "band-green" : "band-red"}`}>{UT_VERIFICATION_LABEL[r.verificationResult as UtVerificationResult]}</span> : "–"}</td>
              <td>{dot(r.verifiedAt)}</td>
              <td>{r.verifierName ?? "–"}</td>
              <td><span className={`badge ${STATUS_BAND[r.verdict]}`}>{r.roundNo}차 {UT_VERDICT_LABEL[r.verdict as UtVerdict]}</span></td>
              <td>{r.defectId ? <><span className="mono">{r.defectDisplayId}</span> <span className={`badge ${STATUS_BAND[r.defectStatus ?? ""]}`}>{UT_DEFECT_STATUS_LABEL[r.defectStatus as UtDefectStatus]}</span></> : "–"}</td>
              <td className="ut-actions">
                {r.canFix && <button className="button primary" onClick={() => setAction({ row: r, kind: "fix" })}>조치</button>}
                {r.canVerify && <button className="button primary" onClick={() => setAction({ row: r, kind: "verify" })}>검증</button>}
                {!r.defectId && r.verdict === "FAIL" && <button className="button primary" onClick={() => setRegister(r)}>결함 등록</button>}
                {r.defectId && <button className="button secondary" onClick={() => showHistory(r.defectId!)}>이력</button>}
              </td>
            </tr>)}</tbody>
          </table>
          {!rows.length && <p className="empty">수행 기록이 없습니다.</p>}
        </div>
      </section>
      <UtPagination basePath="/mp-ut/defects" filters={filters} {...paging} />
      </div>
    </div>

    {action && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={action.kind === "fix" ? "조치 등록" : "검증 등록"}>
      <form className="modal-card" onSubmit={submit}>
        <h2>{action.kind === "fix" ? "조치 등록" : "검증 등록"} — <span className="mono">{action.row.defectDisplayId}</span></h2>
        <p className="ut-pre">{action.row.description}</p>
        {action.kind === "verify" && <label>검증결과<select name="result" defaultValue="PASS"><option value="PASS">적합</option><option value="FAIL">부적합 (재조치)</option></select></label>}
        <label>{action.kind === "fix" ? "조치일" : "검증일자"}<input type="date" name="date" required defaultValue={today()} /></label>
        <label>{action.kind === "fix" ? "조치 내용" : "검증 의견(부적합 시 필수)"}<textarea name="note" rows={3} /></label>
        <small className="ut-hint">{action.kind === "fix" ? "조치자는 로그인 사용자로 기록됩니다." : "검증자는 로그인 사용자로 기록되며, 조치자와 같을 수 없습니다."}</small>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setAction(null)}>취소</button><button className="button primary" disabled={pending}>등록</button></div>
      </form>
    </div>}

    {register && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="결함 등록">
      <form className="modal-card ut-modal-wide" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (n: string) => ((f.get(n) as string) ?? "").trim() || null;
        setPending(true); setMessage(null);
        utApi(`executions/${register.executionId}/defects`, json("POST", { description: v("description"), severity: v("severity"), defectTypeCodeId: v("defectTypeCodeId"), causeGroupId: v("causeGroupId"), vendorGroupId: v("vendorGroupId"), assigneeId: v("assigneeId") }))
          .then(() => { setRegister(null); setMessage({ tone: "ok", text: "결함을 등록했습니다." }); router.refresh(); })
          .catch((err: Error) => setMessage({ tone: "error", text: err.message }))
          .finally(() => setPending(false));
      }}>
        <h2>결함 등록 — <span className="mono">{register.caseDisplayId}</span> {register.roundNo}차</h2>
        <label>결함내용<textarea name="description" rows={3} required /></label>
        <div className="form-grid">
          <label>심각도<select name="severity" defaultValue="MAJOR"><option value="CRITICAL">Critical</option><option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="TRIVIAL">Trivial</option></select></label>
          <label>결함 유형<select name="defectTypeCodeId" defaultValue=""><option value="">미지정</option>{options.codes.defectTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label>원인 업무단위<select name="causeGroupId" defaultValue=""><option value="">미지정</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
          <label>협력사{options.companies.length ? "(필수)" : ""}<select name="vendorGroupId" defaultValue="" required={options.companies.length > 0}><option value="">미지정</option>{options.companies.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        </div>
        <label>조치 담당자<select name="assigneeId" defaultValue=""><option value="">케이스 수행 담당자</option>{options.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setRegister(null)}>취소</button><button className="button primary" disabled={pending}>등록</button></div>
      </form>
    </div>}

    {history && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="조치·검증 이력">
      <div className="modal-card">
        <h2>조치·검증 이력</h2>
        {history.items.length ? <ol className="ut-history">{history.items.map((h, i) => <li key={i}>{dot(h.actedOn)} · {h.actionType === "FIX" ? "조치" : `검증(${h.verificationResult ? UT_VERIFICATION_LABEL[h.verificationResult as UtVerificationResult] : ""})`} · {h.actorName}{h.note ? ` — ${h.note}` : ""}</li>)}</ol> : <p className="empty">이력이 없습니다.</p>}
        <div className="modal-actions"><button className="button secondary" onClick={() => setHistory(null)}>닫기</button></div>
      </div>
    </div>}
  </>;
}
