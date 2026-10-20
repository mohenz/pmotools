"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UT_CASE_STATUS_LABEL, UT_VERDICT_LABEL } from "@/lib/domain/ut";
import type { listMyUtExecutionTargets, listUtApprovalInbox } from "@/lib/server/mp/ut/executions";
import type { listUtReviewInbox } from "@/lib/server/mp/ut/scenarios";
import { json, utApi } from "@/features/mp/ut/client";
import { STATUS_BAND, dot } from "@/features/mp/ut/format";

type Data = {
  targets: Awaited<ReturnType<typeof listMyUtExecutionTargets>>;
  reviews: Awaited<ReturnType<typeof listUtReviewInbox>>;
  qc: Awaited<ReturnType<typeof listUtApprovalInbox>>;
  pl: Awaited<ReturnType<typeof listUtApprovalInbox>>;
};
type Tab = "targets" | "reviews" | "qc" | "pl";

// UT-023·030·031·032 — 내 업무: 수행 대상, 케이스 검토, QC 확인함, PL 확인함. 일괄 승인 없음, 증적 열람 후 확인(8장).
export function UtInboxScreen({ data, rejectReasons }: { data: Data; rejectReasons: { id: string; label: string }[] }) {
  const router = useRouter();
  const first: Tab = data.qc.length ? "qc" : data.pl.length ? "pl" : data.reviews.length ? "reviews" : "targets";
  const [tab, setTab] = useState<Tab>(first);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "targets", label: "내 수행 대상", count: data.targets.length },
    { key: "reviews", label: "케이스 검토", count: data.reviews.length },
    { key: "qc", label: "QC 확인함", count: data.qc.length },
    { key: "pl", label: "PL 확인함", count: data.pl.length },
  ];

  function decide(event: FormEvent<HTMLFormElement>, executionId: string, step: "QC" | "PL") {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "APPROVED";
    setPending(true); setMessage(null);
    utApi(`executions/${executionId}/approval`, json("POST", { step, decision, rejectReasonCodeId: f.get("rejectReasonCodeId") || null, comment: f.get("comment") ?? "" }))
      .then(() => { setMessage({ tone: "ok", text: decision === "APPROVED" ? "확인(승인)했습니다." : "반려했습니다. 수행자가 다음 차수로 재수행합니다." }); router.refresh(); })
      .catch((e: Error) => setMessage({ tone: "error", text: e.message }))
      .finally(() => setPending(false));
  }

  const approvalList = (rows: Data["qc"], step: "QC" | "PL") => rows.length ? rows.map((r) => {
    const allViewed = r.verdict === "NA" || r.evidences.every((v) => v.viewed || viewed.has(v.id));
    return <article key={r.id} className="panel ut-approval-card">
      <div className="panel-head">
        <h2><span className="mono">{r.caseDisplayId}</span> {r.caseName}</h2>
        <span><span className={`badge ${STATUS_BAND[r.verdict]}`}>{r.roundNo}차 {UT_VERDICT_LABEL[r.verdict]}</span> · {r.executorName} · {dot(r.executedOn)} · 대기 {r.waitingDays}일{r.waitingDays > (step === "QC" ? 2 : 1) ? " (SLA 초과)" : ""}</span>
      </div>
      <dl className="ut-dl">
        <div><dt>예상결과</dt><dd>{r.expectedResult || "–"}</dd></div>
        <div><dt>{r.verdict === "NA" ? "N/A 사유" : "실제결과"}</dt><dd>{(r.verdict === "NA" ? r.naReason : r.actualResult) || "–"}</dd></div>
        {step === "PL" && r.qcApprover && <div><dt>QC 의견</dt><dd>{r.qcApprover}: {r.qcComment || "의견 없음"}</dd></div>}
        <div><dt>증적</dt><dd>{r.evidences.length ? r.evidences.map((v) => <a key={v.id} className={`table-link ut-file${v.viewed || viewed.has(v.id) ? " viewed" : ""}`} href={`/api/v1/mp/ut/evidences/${v.id}`} target="_blank" rel="noreferrer" onClick={() => setViewed((s) => new Set(s).add(v.id))}>{v.viewed || viewed.has(v.id) ? "✔ " : ""}{v.fileName}</a>) : "–"}</dd></div>
      </dl>
      <form className="ut-decide" onSubmit={(e) => decide(e, r.id, step)}>
        <label>반려 사유<select name="rejectReasonCodeId" defaultValue=""><option value="">(반려 시 선택)</option>{rejectReasons.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>의견<input name="comment" maxLength={2000} /></label>
        <button className="button primary" name="decision" value="APPROVED" disabled={pending || !allViewed} title={allViewed ? undefined : "증적을 모두 열람해야 확인할 수 있습니다"}>확인(승인)</button>
        <button className="button secondary" name="decision" value="REJECTED" disabled={pending}>반려</button>
        <Link className="table-link" href={`/mp-ut/${r.scenarioId}`}>시나리오</Link>
      </form>
      {!allViewed && <small className="ut-hint">증적을 모두 열람하면 확인 버튼이 활성화됩니다.</small>}
    </article>;
  }) : <p className="empty">처리할 건이 없습니다.</p>;

  return <>
    <header className="topbar"><div><h1>내 단위테스트 업무</h1><p>수행 대상·검토·QC/PL 확인</p></div></header>
    <div className="content">
      <nav className="tool-tabs ut-tabs" aria-label="내 업무">{tabs.map((t) => <button key={t.key} type="button" className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>{t.label} <span className="badge">{t.count}</span></button>)}</nav>
      {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
      {tab === "targets" && <section className="panel"><div className="table-wrap"><table className="ut-table">
        <thead><tr><th>케이스 ID</th><th>케이스명</th><th>시나리오</th><th>WBS</th><th>예정일</th><th>상태</th><th>최근</th></tr></thead>
        <tbody>{data.targets.map((t) => <tr key={t.id} className={t.lastRejected ? "ut-rejected" : undefined}>
          <td className="mono"><Link className="table-link" href={`/mp-ut/${t.scenarioId}`}>{t.displayId}</Link></td><td>{t.name}</td><td>{t.scenarioDisplayId} {t.scenarioName}</td><td className="mono">{t.wbsDisplayId}</td><td>{dot(t.plannedDate)}</td>
          <td><span className={`badge ${STATUS_BAND[t.status]}`}>{UT_CASE_STATUS_LABEL[t.status]}</span></td>
          <td>{t.lastRound ? `${t.lastRound}차 ${t.lastVerdict ? UT_VERDICT_LABEL[t.lastVerdict] : ""}${t.lastRejected ? " · 반려됨" : ""}` : "미수행"}</td>
        </tr>)}</tbody></table>{!data.targets.length && <p className="empty">수행할 케이스가 없습니다.</p>}</div></section>}
      {tab === "reviews" && <section className="panel"><div className="table-wrap"><table className="ut-table">
        <thead><tr><th>시나리오 ID</th><th>시나리오명</th><th>WBS</th><th>작성자</th><th data-numeric>케이스</th><th>요청일</th></tr></thead>
        <tbody>{data.reviews.map((r) => <tr key={r.id}><td className="mono"><Link className="table-link" href={`/mp-ut/${r.id}`}>{r.displayId}</Link></td><td>{r.name}</td><td className="mono">{r.wbsDisplayId}</td><td>{r.writerName}</td><td data-numeric>{r.caseCount}</td><td>{r.requestedAt ? dot(r.requestedAt.slice(0, 10)) : "–"}</td></tr>)}</tbody>
      </table>{!data.reviews.length && <p className="empty">검토 요청된 시나리오가 없습니다.</p>}</div></section>}
      {tab === "qc" && approvalList(data.qc, "QC")}
      {tab === "pl" && approvalList(data.pl, "PL")}
    </div>
  </>;
}
