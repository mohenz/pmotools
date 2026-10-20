"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { listUtReviewInbox } from "@/lib/server/mp/ut/scenarios";
import type { UtTreeNode } from "@/lib/server/mp/ut/grid";
import { json, utApi } from "@/features/mp/ut/client";
import { dot } from "@/features/mp/ut/format";
import { UtWbsTree } from "@/features/mp/ut/UtWbsTree";

type Row = Awaited<ReturnType<typeof listUtReviewInbox>>[number];

// UT-023 케이스 검토·승인함 — 검토요청 목록, 일괄 승인·반려(사유 필수). 설계서 8장.
export function UtReviewInboxScreen({ tree, rows }: { tree: UtTreeNode[]; rows: Row[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const all = rows.length > 0 && rows.every((r) => checked.has(r.id));

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!checked.size) return setMessage({ tone: "error", text: "처리할 시나리오를 선택해 주세요." });
    if (decision === "REJECTED" && !reason.trim()) return setMessage({ tone: "error", text: "반려 사유를 입력해 주세요." });
    setPending(true); setMessage(null);
    const failures: string[] = [];
    for (const id of checked) {
      try { await utApi(`scenarios/${id}/decision`, json("POST", { decision, reason })); }
      catch (e) { failures.push(`${rows.find((r) => r.id === id)?.displayId}: ${(e as Error).message}`); }
    }
    setPending(false); setChecked(new Set()); setReason("");
    setMessage(failures.length ? { tone: "error", text: `일부 처리 실패 — ${failures.join(" / ")}` } : { tone: "ok", text: decision === "APPROVED" ? "승인했습니다." : "반려했습니다." });
    router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>케이스 검토·승인함</h1><p>UT-023 · 내가 PL인 검토요청 {rows.length}건</p></div></header>
    <div className="content ut-split">
      <UtWbsTree nodes={tree} />
      <div className="ut-main">
        <div className="filters requirement-filter-panel">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유(반려 시 필수)" aria-label="반려 사유" maxLength={1000} />
          <button className="button primary" type="button" disabled={pending} onClick={() => decide("APPROVED")}>선택 승인</button>
          <button className="button secondary" type="button" disabled={pending} onClick={() => decide("REJECTED")}>선택 반려</button>
          <span className="ut-hint">선택 {checked.size}건</span>
        </div>
        {message && <p className={`action-message ${message.tone === "ok" ? "ut-ok" : ""}`} role="status">{message.text}</p>}
        <section className="panel compact">
          {rows.length ? <div className="table-wrap"><table className="ut-table">
            <thead><tr><th><input type="checkbox" aria-label="전체 선택" checked={all} onChange={(e) => setChecked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th><th>WBS</th><th>시나리오 ID</th><th>시나리오명</th><th>우선순위</th><th>작성자</th><th data-numeric>케이스</th><th data-numeric>정상</th><th data-numeric>예외·경계</th><th>요청일</th><th /></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}>
              <td><input type="checkbox" aria-label={`${r.displayId} 선택`} checked={checked.has(r.id)} onChange={(e) => setChecked((s) => { const x = new Set(s); if (e.target.checked) x.add(r.id); else x.delete(r.id); return x; })} /></td>
              <td className="mono" title={r.wbsName}>{r.wbsDisplayId}</td>
              <td className="mono">{r.displayId}</td>
              <td>{r.name}</td>
              <td>{r.priority}</td>
              <td>{r.writerName}</td>
              <td data-numeric>{r.caseCount}</td>
              <td data-numeric className={r.normalCount < 1 ? "critical" : undefined}>{r.normalCount}</td>
              <td data-numeric className={r.edgeCount < 2 ? "critical" : undefined}>{r.edgeCount}</td>
              <td>{r.requestedAt ? dot(r.requestedAt.slice(0, 10)) : "–"}</td>
              <td><Link className="table-link" href={`/mp-ut?wbs=${r.wbsItemId}`}>케이스 보기</Link></td>
            </tr>)}</tbody>
          </table></div> : <div className="empty">검토 요청된 시나리오가 없습니다.</div>}
        </section>
      </div>
    </div>
  </>;
}
