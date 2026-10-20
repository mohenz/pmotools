"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_VERDICT_LABEL } from "@/lib/domain/ut";
import type { listUtApprovalInbox } from "@/lib/server/mp/ut/executions";
import type { plPendingByWbs, UtTreeNode } from "@/lib/server/mp/ut/grid";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot } from "@/features/mp/ut/format";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";

type Row = Awaited<ReturnType<typeof listUtApprovalInbox>>[number];
type Remaining = Awaited<ReturnType<typeof plPendingByWbs>>;

// UT-031 QC 확인함 / UT-032 PL 확인함 — 건별 증적 열람 후 승인·반려(사유코드), 일괄 승인 없음, SLA 경과 표시. PL은 WBS별 잔여 건수.
export function UtApprovalInboxScreen({ step, tree, rows, rejectReasons, remaining }: { step: "QC" | "PL"; tree: UtTreeNode[]; rows: Row[]; rejectReasons: { id: string; label: string }[]; remaining?: Remaining }) {
  const router = useRouter();
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const sla = step === "QC" ? 2 : 1;

  function decide(event: FormEvent<HTMLFormElement>, executionId: string) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "APPROVED";
    setPending(true); setMessage(null);
    utApi(`executions/${executionId}/approval`, json("POST", { step, decision, rejectReasonCodeId: f.get("rejectReasonCodeId") || null, comment: f.get("comment") ?? "" }))
      .then(() => { setMessage({ tone: "ok", text: decision === "APPROVED" ? "승인했습니다." : "반려했습니다. 수행자가 다음 차수로 재수행합니다." }); router.refresh(); })
      .catch((e: Error) => setMessage({ tone: "error", text: e.message }))
      .finally(() => setPending(false));
  }

  return <>
    <header className="topbar"><div><h1>{step} 확인함</h1><p>{step === "QC" ? "UT-031 · QC대기" : "UT-032 · PL대기"} {rows.length}건 · SLA {sla}영업일</p></div></header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
        {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
        {step === "PL" && remaining && remaining.length > 0 && <section className="panel compact"><div className="panel-head"><h2>WBS별 잔여 건수</h2></div>
          <div className="ut-remaining">{remaining.map((w) => <span key={w.wbsItemId} className="badge band-yellow" title={w.name}>{w.displayId} · {w.count}건</span>)}</div></section>}
        {rows.length ? rows.map((r) => {
          const allViewed = r.verdict === "NA" || (r.evidences.length > 0 && r.evidences.every((v) => v.viewed || viewed.has(v.id)));
          return <article key={r.id} className="panel ut-approval-card">
            <div className="panel-head">
              <h2><span className="mono">{r.caseDisplayId}</span> {r.caseName}</h2>
              <span><span className={`badge ${STATUS_BAND[r.verdict]}`}>{r.roundNo}차 {UT_VERDICT_LABEL[r.verdict]}</span> · WBS {r.wbsDisplayId} · {r.executorName} · {dot(r.executedOn)} · 대기 {r.waitingDays}일{r.waitingDays > sla && <strong className="critical"> SLA 경과</strong>}</span>
            </div>
            <dl className="ut-dl">
              <div><dt>예상결과</dt><dd>{r.expectedResult || "–"}</dd></div>
              <div><dt>{r.verdict === "NA" ? "N/A 사유" : "실제결과"}</dt><dd>{(r.verdict === "NA" ? r.naReason : r.actualResult) || "–"}</dd></div>
              {step === "PL" && r.qcApprover && <div><dt>QC 의견</dt><dd>{r.qcApprover}: {r.qcComment || "의견 없음"}</dd></div>}
              <div><dt>증적</dt><dd>{r.evidences.length ? r.evidences.map((v) => <a key={v.id} className={`table-link ut-file${v.viewed || viewed.has(v.id) ? " viewed" : ""}`} href={`/api/v1/mp/ut/evidences/${v.id}`} target="_blank" rel="noreferrer" onClick={() => setViewed((s) => new Set(s).add(v.id))}>{v.viewed || viewed.has(v.id) ? "✔ " : ""}{v.fileName}</a>) : "–"}</dd></div>
            </dl>
            <form className="ut-decide" onSubmit={(e) => decide(e, r.id)}>
              <label>반려 사유<select name="rejectReasonCodeId" defaultValue=""><option value="">(반려 시 선택)</option>{rejectReasons.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
              <label>의견<input name="comment" maxLength={2000} /></label>
              <button className="button primary" name="decision" value="APPROVED" disabled={pending || !allViewed} title={allViewed ? undefined : "증적을 모두 열람해야 승인할 수 있습니다"}>승인</button>
              <button className="button secondary" name="decision" value="REJECTED" disabled={pending}>반려</button>
              <Link className="table-link" href={`/mp-ut/cases/${r.caseId}`}>케이스</Link>
            </form>
            {!allViewed && <small className="ut-hint">증적을 모두 열람하면 승인 버튼이 활성화됩니다.</small>}
          </article>;
        }) : <section className="panel compact"><div className="empty">확인할 건이 없습니다.</div></section>}
      </div>
    </div>
  </>;
}
