"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_DEFECT_STATUS_LABEL, UT_VERDICT_LABEL, UT_VERIFICATION_LABEL, type UtDefectStatus, type UtVerdict, type UtVerificationResult } from "@/lib/domain/ut";
import type { UtRunRow } from "@/lib/server/mp/ut/defects";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot, today } from "@/features/mp/ut/format";

// UT-040 — 설계서 5.1 테스트 수행·결함 관리 양식(13개 열). 조치·검증은 행에서 등록(수기), 이력은 결함 단위로 보존.
export function UtRunsScreen({ rows, filters }: { rows: UtRunRow[]; filters: Record<string, string> }) {
  const router = useRouter();
  const [action, setAction] = useState<{ row: UtRunRow; kind: "fix" | "verify" } | null>(null);
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
      <div><h1>테스트 수행·결함 관리</h1><p>수행 1건 × 결함 n건 · {rows.length}행</p></div>
      <div className="topbar-actions"><a className="button secondary" href={`/api/v1/mp/ut/runs?${query}${query ? "&" : ""}format=xlsx`}>엑셀 출력</a></div>
    </header>
    <div className="content">
      <section className="panel">
        <form className="filters inline-filter ut-filters" method="get">
          {filters.scenarioId && <input type="hidden" name="scenarioId" value={filters.scenarioId} />}
          <label>검색<input name="q" defaultValue={filters.q ?? ""} placeholder="케이스ID·명·결함내용" /></label>
          <label className="ut-check"><input type="checkbox" name="defectOnly" value="1" defaultChecked={filters.defectOnly === "1"} />결함 있는 건만</label>
          <label className="ut-check"><input type="checkbox" name="openOnly" value="1" defaultChecked={filters.openOnly === "1"} />미검증 결함만</label>
          <button className="button secondary" type="submit">조회</button>
          {filters.scenarioId && <Link className="button secondary" href="/mp-ut/runs">전체 보기</Link>}
        </form>
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
                {r.defectId && <button className="button secondary" onClick={() => showHistory(r.defectId!)}>이력</button>}
              </td>
            </tr>)}</tbody>
          </table>
          {!rows.length && <p className="empty">수행 기록이 없습니다.</p>}
        </div>
      </section>
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

    {history && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="조치·검증 이력">
      <div className="modal-card">
        <h2>조치·검증 이력</h2>
        {history.items.length ? <ol className="ut-history">{history.items.map((h, i) => <li key={i}>{dot(h.actedOn)} · {h.actionType === "FIX" ? "조치" : `검증(${h.verificationResult ? UT_VERIFICATION_LABEL[h.verificationResult as UtVerificationResult] : ""})`} · {h.actorName}{h.note ? ` — ${h.note}` : ""}</li>)}</ol> : <p className="empty">이력이 없습니다.</p>}
        <div className="modal-actions"><button className="button secondary" onClick={() => setHistory(null)}>닫기</button></div>
      </div>
    </div>}
  </>;
}
