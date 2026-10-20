"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_CASE_STATUS_LABEL, UT_VERDICT_LABEL } from "@/lib/domain/ut";
import type { listMyUtExecutionTargets } from "@/lib/server/mp/ut/executions";
import type { UtTreeNode } from "@/lib/server/mp/ut/grid";
import { utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot, today } from "@/features/mp/ut/format";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";

type Row = Awaited<ReturnType<typeof listMyUtExecutionTargets>>[number];

// UT-030 내 수행 목록 — 예정일순 수행 대상, 판정·실제결과·증적 입력, 반려 건 우선 표시. 설계서 8장.
export function UtMyExecutionsScreen({ tree, rows, envs }: { tree: UtTreeNode[]; rows: Row[]; envs: { id: string; label: string }[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, caseId: string) {
    event.preventDefault(); setPending(true); setMessage(null);
    try { await utApi(`cases/${caseId}/executions`, { method: "POST", body: new FormData(event.currentTarget) }); setOpenId(null); setMessage({ tone: "ok", text: "수행 결과를 등록했습니다." }); router.refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); }
    finally { setPending(false); }
  }

  return <>
    <header className="topbar"><div><h1>내 수행 목록</h1><p>UT-030 · 예정일순 · 반려 건 우선 · {rows.length}건</p></div></header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
        {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
        <section className="panel compact">
          {rows.length ? <div className="table-wrap"><table className="ut-table">
            <thead><tr><th>예정일</th><th>WBS</th><th>케이스 ID</th><th>케이스명</th><th>시나리오</th><th>상태</th><th>최근</th><th /></tr></thead>
            <tbody>{rows.map((r) => [
              <tr key={r.id} className={r.lastRejected ? "ut-rejected" : undefined}>
                <td>{dot(r.plannedDate)}</td>
                <td className="mono" title={r.wbsName}>{r.wbsDisplayId}</td>
                <td className="mono"><Link className="table-link" href={`/mp-ut/cases/${r.id}`}>{r.displayId}</Link></td>
                <td>{r.name}</td>
                <td>{r.scenarioName}</td>
                <td><span className={`badge ${STATUS_BAND[r.status]}`}>{UT_CASE_STATUS_LABEL[r.status]}</span></td>
                <td>{r.lastRound ? `${r.lastRound}차 ${r.lastVerdict ? UT_VERDICT_LABEL[r.lastVerdict] : ""}${r.lastRejected ? " · 반려" : ""}` : "미수행"}</td>
                <td><button className="button primary" type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)}>판정 입력</button></td>
              </tr>,
              openId === r.id && <tr key={`${r.id}-form`} className="ut-expand"><td colSpan={8}>
                <dl className="ut-dl"><div><dt>사전조건</dt><dd>{r.precondition || "–"}</dd></div><div><dt>입력데이터</dt><dd>{r.inputData || "–"}</dd></div><div><dt>테스트스텝</dt><dd className="ut-pre">{r.steps || "–"}</dd></div><div><dt>예상결과</dt><dd>{r.expectedResult || "–"}</dd></div></dl>
                <form className="ut-exec-form" onSubmit={(e) => submit(e, r.id)}>
                  <div className="form-grid triple">
                    <label>판정<select name="verdict" defaultValue="PASS"><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="BLOCKED">Blocked</option><option value="NA">N/A</option></select></label>
                    <label>테스트수행일<input type="date" name="executedOn" defaultValue={today()} /></label>
                    <label>수행 환경<select name="envCodeId" defaultValue=""><option value="">미지정</option>{envs.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
                  </div>
                  <label>실제결과(Fail 필수)<textarea name="actualResult" rows={2} /></label>
                  <label>N/A 사유(N/A 필수)<input name="naReason" maxLength={1000} /></label>
                  <label>증적(Pass·Fail 필수, 여러 개 가능)<input type="file" name="evidence" multiple /></label>
                  <div className="form-actions"><button className="button primary" disabled={pending}>{pending ? "등록 중…" : "등록"}</button><button type="button" className="button secondary" onClick={() => setOpenId(null)}>취소</button></div>
                </form>
              </td></tr>,
            ])}</tbody>
          </table></div> : <div className="empty">수행할 케이스가 없습니다.</div>}
        </section>
      </div>
    </div>
  </>;
}
