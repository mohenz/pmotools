"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { WbsOwnerConflict } from "@/lib/server/wbs";

export function WbsOwnerConflictsScreen({ conflicts }: { conflicts: WbsOwnerConflict[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  async function apply(conflict: WbsOwnerConflict) {
    const ownerUserId = selected[conflict.itemId];
    if (!ownerUserId) { setMessage("담당자 후보를 먼저 선택하세요."); return; }
    setPending(conflict.itemId); setMessage("");
    const response = await fetch(`/api/v1/wbs-items/${conflict.itemId}/owner-ambiguity`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerUserId }) });
    const payload = await response.json().catch(() => null);
    setPending("");
    if (!response.ok) { setMessage(payload?.error?.message ?? "담당자를 확정하지 못했습니다."); return; }
    router.refresh();
  }

  return <>
    <header className="topbar"><div><h1>동명이인 담당자 정리</h1><p>이름이 여러 사용자와 겹쳐 미지정으로 남은 WBS 항목의 담당자를 확정합니다.</p></div><div className="topbar-actions"><Link className="button secondary" href="/wbs/manage">데이터 관리로</Link></div></header>
    <div className="content">
      {message && <p className="form-error action-message" role="alert">{message}</p>}
      <section className="panel">
        <div className="panel-head"><h2>동명이인 대상</h2><span>{conflicts.length}건</span></div>
        {conflicts.length ? <div className="table-wrap"><table>
          <thead><tr><th>Task</th><th>Task Description</th><th>입력된 이름</th><th>후보 선택</th><th /></tr></thead>
          <tbody>{conflicts.map((conflict) => <tr key={conflict.itemId}>
            <td className="mono">{conflict.code}</td>
            <td className="title-cell"><Link className="table-link" href={`/wbs/${conflict.itemId}`}>{conflict.name}</Link></td>
            <td>{conflict.ownerNameRaw}</td>
            <td>
              <select aria-label={`${conflict.name} 담당자 후보`} value={selected[conflict.itemId] ?? ""} onChange={(event) => setSelected((prev) => ({ ...prev, [conflict.itemId]: event.target.value }))}>
                <option value="">선택</option>
                {conflict.candidates.map((candidate) => <option value={candidate.userId} key={candidate.userId}>{candidate.name} ({candidate.loginId})</option>)}
              </select>
            </td>
            <td><button className="button secondary" type="button" disabled={pending === conflict.itemId} onClick={() => apply(conflict)}>{pending === conflict.itemId ? "적용 중…" : "적용"}</button></td>
          </tr>)}</tbody>
        </table></div> : <div className="empty">동명이인으로 미지정된 항목이 없습니다.</div>}
      </section>
    </div>
  </>;
}
