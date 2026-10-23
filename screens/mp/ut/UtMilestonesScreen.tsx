"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { listUtMilestones } from "@/lib/server/mp/ut/milestones";
import { json, utApi } from "@/features/mp/ut/client";
import { dot, today } from "@/features/mp/ut/format";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";
import type { UtTreeNode } from "@/lib/server/mp/ut/grid";

type Row = Awaited<ReturnType<typeof listUtMilestones>>[number];

// UT-013 — WBS 이정표 수기 기록(2.1): 개발완료 선언→PL 확인, UT완료 기록. WBS 진척은 바꾸지 않으며 대조만 보여 준다.
export function UtMilestonesScreen({ tree, rows }: { tree: UtTreeNode[]; rows: Row[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const mismatches = rows.filter((r) => r.mismatch).length;

  function act(path: string, body: unknown, done: string) {
    setPending(true); setMessage(null);
    utApi(path, json("POST", body)).then(() => { setMessage({ tone: "ok", text: done }); router.refresh(); }).catch((e: Error) => setMessage({ tone: "error", text: e.message })).finally(() => setPending(false));
  }
  const ask = (label: string, fallback = "") => window.prompt(label, fallback);

  return <>
    <header className="topbar"><div><h1>WBS 이정표 기록</h1><p>UT-013 · 개발완료·UT완료 수기 기록 · 케이스가 있는 Leaf WBS {rows.length}건{mismatches ? ` · 진척 불일치 ${mismatches}건` : ""}</p></div></header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
      {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
      <section className="panel">
        <p className="ut-hint">UT완료 조건(①케이스 등록 ②수행 ③Pass·Open 결함 0 ④증적·PL확인)은 참고용 현황입니다. PL이 확인해 기록하며, WBS 진척률·실적종료일은 담당자가 WBS 화면에서 직접 입력합니다.</p>
        <div className="table-wrap">
          <table className="ut-table">
            <thead><tr><th>WBS</th><th>Task</th><th>담당</th><th>계획종료</th><th>UT 조건</th><th>개발완료</th><th>PL 확인</th><th>UT완료</th><th>WBS 진척</th><th /></tr></thead>
            <tbody>{rows.map((r) => {
              const c = r.conditions.conditions;
              const met = [c.c1Approved, c.c2AllExecuted, c.c3AllPassedNoOpenDefect, c.c4EvidenceAndConfirmed].filter(Boolean).length;
              return <tr key={r.wbsItemId} className={r.mismatch ? "ut-rejected" : undefined}>
                <td className="mono">{r.displayId}<small className="ut-hint">{r.code}</small></td>
                <td>{r.name}</td>
                <td>{r.ownerName ?? "–"}</td>
                <td>{dot(r.dueDate)}</td>
                <td title={`등록 ${r.conditions.approvedCount}/${r.conditions.activeCount} · 수행 ${r.conditions.executedCount}/${r.conditions.targetCount} · Pass ${r.conditions.passedCount} · Open 결함 ${r.conditions.blockingOpenDefectCount} · PL확인 ${r.conditions.confirmedCount}`}><span className={`badge ${met === 4 ? "band-green" : "band-yellow"}`}>{met}/4</span></td>
                <td>{r.devCompletedOn ? `${dot(r.devCompletedOn)} · ${r.devDeclaredBy}` : "–"}</td>
                <td>{r.devConfirmedBy ?? (r.devCompletedOn ? "확인 대기" : "–")}</td>
                <td>{r.utCompletedOn ? `${dot(r.utCompletedOn)} · ${r.utRecordedBy}` : "–"}</td>
                <td>{Math.round(r.wbsProgress * 100)}%{r.mismatch && <small className="ut-missing">UT완료 미기록</small>}</td>
                <td className="ut-actions">
                  {r.can.declare && <button className="button secondary" disabled={pending} onClick={() => { const d = ask("개발완료일 (YYYY-MM-DD)", today()); if (d) act(`milestones/${r.wbsItemId}/declare`, { devCompletedOn: d }, "개발완료 선언"); }}>개발완료 선언</button>}
                  {r.can.confirm && <button className="button primary" disabled={pending} onClick={() => act(`milestones/${r.wbsItemId}/confirm`, { decision: "APPROVED", version: r.version }, "개발완료 확인")}>개발완료 확인</button>}
                  {r.can.confirm && <button className="button secondary" disabled={pending} onClick={() => { const reason = ask("반려 사유"); if (reason) act(`milestones/${r.wbsItemId}/confirm`, { decision: "REJECTED", reason, version: r.version }, "개발완료 반려"); }}>반려</button>}
                  {r.can.recordUt && <button className="button primary" disabled={pending} onClick={() => { if (met < 4 && !window.confirm(`UT완료 조건 ${met}/4 충족입니다. 그래도 UT완료를 기록할까요? (1단계 수기 판단)`)) return; const d = ask("UT완료일 (YYYY-MM-DD)", today()); if (d) act(`milestones/${r.wbsItemId}/ut`, { utCompletedOn: d }, "UT완료 기록"); }}>UT완료 기록</button>}
                  {r.can.cancel && <button className="button secondary" disabled={pending} onClick={() => { const target = r.utCompletedOn ? "UT" : "DEV"; const reason = ask(`${target === "UT" ? "UT완료" : "개발완료"} 기록 취소 사유`); if (reason) act(`milestones/${r.wbsItemId}/cancel`, { target, reason }, "기록 취소"); }}>기록 취소</button>}
                </td>
              </tr>;
            })}</tbody>
          </table>
          {!rows.length && <p className="empty">케이스가 등록된 WBS가 없습니다.</p>}
        </div>
      </section>
      </div>
    </div>
  </>;
}
